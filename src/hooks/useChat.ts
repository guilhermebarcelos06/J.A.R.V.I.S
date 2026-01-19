import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { ChatMessage } from '../types';

// Determine Backend URL - Default to production if local not set
const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('jarvis_backend_url');
        if (local) return local.replace(/\/$/, '');
    }
    return ((import.meta as any).env?.VITE_BACKEND_URL || 'https://jarvis-backend-w3sx.onrender.com').replace(/\/$/, '');
};
const BACKEND_URL = getBackendUrl();

export const useChat = (userId?: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<any>(null);
  const [fetchedApiKey, setFetchedApiKey] = useState<string | null>(null);

  // Fetch API Key on mount
  useEffect(() => {
    const fetchKey = async () => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/config`);
            if (res.ok) {
                const data = await res.json();
                if (data.apiKey) {
                    setFetchedApiKey(data.apiKey);
                    return;
                }
            }
            throw new Error("Backend config check failed");
        } catch (e) {
             console.warn("Chat: Backend unavailable, checking local environment keys...");
             // Fallback to client-side env var if backend fails
             const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                            (import.meta as any).env?.VITE_API_KEY || 
                            (window as any).GEMINI_API_KEY;
             if (envKey) {
                 console.log("Chat: Using local fallback key");
                 setFetchedApiKey(envKey);
             } else {
                 console.warn("Chat: No API key found in Backend or Local Environment");
             }
        }
    };
    fetchKey();
  }, []);

  // Load History when userId changes
  useEffect(() => {
      if (!userId || userId === 'local-admin') return;
      
      const loadHistory = async () => {
          try {
              const res = await fetch(`${BACKEND_URL}/api/chat/${userId}`);
              if (res.ok) {
                  const data = await res.json();
                  if (data.messages) {
                      setMessages(data.messages);
                  }
              }
          } catch (e) {
              console.warn("History unavailable (Offline Mode)");
          }
      };
      loadHistory();
  }, [userId]);

  // Save History Function
  const saveHistory = useCallback(async (newMessages: ChatMessage[]) => {
      if (!userId || userId === 'local-admin') return;
      try {
          await fetch(`${BACKEND_URL}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, messages: newMessages })
          });
      } catch (e) {
          // Silent fail for history saving in offline mode
          console.warn("Failed to save history to backend");
      }
  }, [userId]);

  const initializeChat = useCallback(async () => {
    if (!chatSessionRef.current) {
        if (!fetchedApiKey) {
            console.error("API Key missing");
            return;
        }
        const ai = new GoogleGenAI({ apiKey: fetchedApiKey });
        chatSessionRef.current = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
                systemInstruction: "Você é o J.A.R.V.I.S. Responda de forma concisa, inteligente e com um leve tom irônico e leal. Você é uma interface de terminal de texto agora. Responda sempre em Português.",
            },
            history: messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text || '' }]
            }))
        });
    }
  }, [fetchedApiKey, messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    saveHistory(updatedMessages);
    setIsLoading(true);

    try {
        if (!fetchedApiKey) throw new Error("API Key not found. Please check settings or .env file.");
        
        await initializeChat();
        if (!chatSessionRef.current) throw new Error("Chat initialization failed");

        const result = await chatSessionRef.current.sendMessage({ message: text });
        
        const responseText = result.text;

        const aiMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: responseText,
            timestamp: Date.now(),
        };
        const finalMessages = [...updatedMessages, aiMsg];
        setMessages(finalMessages);
        saveHistory(finalMessages);

    } catch (error: any) {
        console.error("Chat Error:", error);
        let errorText = "Unable to reach Jarvis Mainframe.";
        
        // Detect Leaked Key Error specifically
        if (error.message?.includes('API key was reported as leaked') || error.toString().includes('leaked')) {
            errorText = "ALERTA CRÍTICO: Sua chave de API foi vazada e bloqueada pelo Google. Gere uma nova chave no Google AI Studio e atualize o Render.";
        } else if (error.status === 403) {
            errorText = "ACESSO NEGADO: Chave de API inválida ou expirada.";
        } else if (error.message) {
            errorText = `Error: ${error.message}`;
        }

        const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: errorText,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsLoading(false);
    }
  }, [initializeChat, fetchedApiKey, messages, saveHistory]);

  return {
    messages,
    sendMessage,
    isLoading
  };
};