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
            errorText = "CRITICAL SECURITY ALERT: Your API Key has been leaked and blocked by Google. Please generate a new key in Google AI Studio and update your Render Environment Variables immediately.";
        } else if (error.status === 403) {
            errorText = "ACCESS DENIED: API Key invalid or expired.";
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
        let imageUrl: string | undefined;

        // 1. Try Backend
        try {
            const response = await fetch(`${BACKEND_URL}/api/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.imageUrl) {
                    imageUrl = data.imageUrl;
                }
            }
        } catch (backendError) {
            console.warn("Backend unavailable for image, switching to client-side generation...");
        }

        // 2. Client-side Fallback
        if (!imageUrl) {
            if (!fetchedApiKey) throw new Error("API Key missing. Cannot generate image without backend or local key.");
            
            const ai = new GoogleGenAI({ apiKey: fetchedApiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts: [{ text: prompt }] },
                config: {
                    imageConfig: { aspectRatio: "1:1" },
                    // Safety settings for direct client call
                    safetySettings: [
                        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                    ]
                }
            });

            const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
            if (part && part.inlineData) {
                imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }

        let aiMsg: ChatMessage;

        if (imageUrl) {
            aiMsg = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                image: imageUrl,
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
           
           let errorText = `Image generation protocol failed: ${error.message || "Unknown error"}`;
           if (error.message?.includes('leaked')) {
               errorText = "SYSTEM LOCKDOWN: API Key Compromised. Please rotate credentials.";
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
  }, [messages, saveHistory, fetchedApiKey]);

  return {
    messages,
    sendMessage,
    generateImage,
    isLoading
  };
};