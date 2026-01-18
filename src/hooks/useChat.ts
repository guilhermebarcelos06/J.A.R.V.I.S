import { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { ChatMessage } from '../types';

// Determine Backend URL: Check LocalStorage first, then Env
const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('jarvis_backend_url');
        if (local) return local.replace(/\/$/, '');
    }
    return ((import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
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
                if (data.apiKey) setFetchedApiKey(data.apiKey);
            }
        } catch (e) {
            console.warn("Backend unavailable for chat config");
             // Fallback
             const envKey = process.env.API_KEY || (window as any).GEMINI_API_KEY;
             if (envKey) setFetchedApiKey(envKey);
        }
    };
    fetchKey();
  }, []);

  // Load History when userId changes
  useEffect(() => {
      if (!userId) return;
      
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
              console.error("Failed to load history", e);
          }
      };
      loadHistory();
  }, [userId]);

  // Save History Function
  const saveHistory = useCallback(async (newMessages: ChatMessage[]) => {
      if (!userId) return;
      try {
          await fetch(`${BACKEND_URL}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId, messages: newMessages })
          });
      } catch (e) {
          console.error("Failed to save history", e);
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
                systemInstruction: "You are Jarvis. Respond concisely, intelligently, and with a slight dry wit. You are a text-based terminal interface now.",
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
        if (!fetchedApiKey) throw new Error("Server disconnected");
        
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

    } catch (error) {
        console.error("Chat Error:", error);
        const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: "Error: Unable to reach Jarvis Mainframe (Backend).",
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsLoading(false);
    }
  }, [initializeChat, fetchedApiKey, messages, saveHistory]);

  const generateImage = useCallback(async (prompt: string) => {
      if (!prompt.trim()) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: `Generate image: ${prompt}`,
        timestamp: Date.now(),
      };
      
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      saveHistory(updatedMessages);
      setIsLoading(true);

      try {
        // Use the backend proxy for image generation
        const response = await fetch(`${BACKEND_URL}/api/generate-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.statusText}`);
        }

        const data = await response.json();

        let aiMsg: ChatMessage;

        if (data.success && data.imageUrl) {
            aiMsg = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                image: data.imageUrl,
                text: "Visual rendering complete.",
                timestamp: Date.now(),
            };
        } else {
             aiMsg = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: "Visual processors failed to render output.",
                timestamp: Date.now(),
            };
        }
        const finalMessages = [...updatedMessages, aiMsg];
        setMessages(finalMessages);
        saveHistory(finalMessages);

      } catch (error: any) {
          console.error("Image Gen Error:", error);
           const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: `Image generation protocol failed: ${error.message || "Unknown error"}`,
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMsg]);
      } finally {
          setIsLoading(false);
      }
  }, [messages, saveHistory]);

  return {
    messages,
    sendMessage,
    generateImage,
    isLoading
  };
};