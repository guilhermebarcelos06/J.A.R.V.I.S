import { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, HarmBlockThreshold, HarmCategory } from '@google/genai';
import { ChatMessage } from '../types';

export const useChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<any>(null);

  const getApiKey = () => {
     return (window as any).GEMINI_API_KEY || process.env.API_KEY;
  };

  const initializeChat = useCallback(async () => {
    if (!chatSessionRef.current) {
        const apiKey = getApiKey();
        if (!apiKey) {
            console.error("API Key missing");
            return;
        }
        const ai = new GoogleGenAI({ apiKey });
        chatSessionRef.current = ai.chats.create({
            model: 'gemini-3-flash-preview',
            config: {
                systemInstruction: "You are Jarvis. Respond concisely, intelligently, and with a slight dry wit. You are a text-based terminal interface now.",
            }
        });
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
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
        setMessages(prev => [...prev, aiMsg]);

    } catch (error) {
        console.error("Chat Error:", error);
        const errorMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: "Error processing request. Communications disrupted.",
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMsg]);
    } finally {
        setIsLoading(false);
    }
  }, [initializeChat]);

  const generateImage = useCallback(async (prompt: string) => {
      if (!prompt.trim()) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: `Generate image: ${prompt}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("API Key missing");

        const ai = new GoogleGenAI({ apiKey });
        
        console.log("Generating image with prompt:", prompt);

        // Using gemini-2.5-flash-image for general image generation
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: [
                {
                    parts: [{ text: prompt }]
                }
            ],
            config: {
                imageConfig: {
                    aspectRatio: "1:1"
                },
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
                ]
            }
        });

        let foundImage = false;
        
        // Iterate through parts to find the image
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64String = part.inlineData.data;
                    const imageUrl = `data:${part.inlineData.mimeType};base64,${base64String}`;
                    
                    const aiMsg: ChatMessage = {
                        id: (Date.now() + 1).toString(),
                        role: 'model',
                        image: imageUrl,
                        text: "Visual rendering complete.",
                        timestamp: Date.now(),
                    };
                    setMessages(prev => [...prev, aiMsg]);
                    foundImage = true;
                }
            }
        }

        if (!foundImage) {
             console.warn("No image found in response parts:", response);
             const aiMsg: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: "I attempted to generate an image, but the visual processors returned no data. The prompt might be filtered or the model is busy.",
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, aiMsg]);
        }

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
  }, []);

  return {
    messages,
    sendMessage,
    generateImage,
    isLoading
  };
};