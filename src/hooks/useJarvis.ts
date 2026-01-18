import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

// Determine Backend URL: Check LocalStorage first, then Env, then localhost fallback
const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('jarvis_backend_url');
        if (local) return local.replace(/\/$/, '');
    }
    return ((import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
};
const BACKEND_URL = getBackendUrl();

const TERMINATE_TOOL: FunctionDeclaration = {
  name: "terminateSession",
  description: "Terminates the voice session immediately. Call this when the user says 'terminate', 'disconnect', 'shutdown', or 'stop'.",
  parameters: {
    type: Type.OBJECT,
    properties: {},
  }
};

const SET_VOLUME_TOOL: FunctionDeclaration = {
  name: "setVolume",
  description: "Sets the speaking volume level. Level must be a number between 0 and 100.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      level: {
        type: Type.NUMBER,
        description: "The target volume level from 0 to 100.",
      },
    },
    required: ["level"],
  },
};

const SWITCH_TAB_TOOL: FunctionDeclaration = {
  name: "switchTab",
  description: "Switches the application interface tab. Use this when the user asks to see the chat, terminal, images, or image generator.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tab: {
        type: Type.STRING,
        description: "The tab to switch to. Options: 'voice' (for main interface), 'chat' (for text terminal), 'image' (for image generation).",
        enum: ['voice', 'chat', 'image']
      },
    },
    required: ["tab"],
  },
};

const PLAY_VIDEO_TOOL: FunctionDeclaration = {
  name: "playVideo",
  description: "Searches and plays a video from YouTube. Use this when the user asks to play a song, watch a video, or see something.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query for the video (e.g. 'Bohemian Rhapsody', 'lofi beats', 'funny cats').",
      },
    },
    required: ["query"],
  },
};

interface UseJarvisProps {
    onCommand?: (command: string) => void;
    onPlayVideo?: (videoId: string, title: string) => void;
}

export const useJarvis = ({ onCommand, onPlayVideo }: UseJarvisProps = {}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5); // Default 50%
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [fetchedApiKey, setFetchedApiKey] = useState<string | null>(null);

  // Audio Contexts
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  
  // Streaming References
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Helper refs to access state in callbacks
  const connectionStateRef = useRef(connectionState);
  const volumeRef = useRef(volume);
  const onCommandRef = useRef(onCommand);
  const onPlayVideoRef = useRef(onPlayVideo);

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
      onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
      onPlayVideoRef.current = onPlayVideo;
  }, [onPlayVideo]);

  useEffect(() => {
    volumeRef.current = volume;
    // Update active gain node if it exists
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(volume, outputAudioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [volume]);

  // Fetch API Key from Backend on mount
  useEffect(() => {
    const fetchKey = async () => {
        try {
            // Use dynamic backend URL
            const res = await fetch(`${BACKEND_URL}/api/config`);
            if (res.ok) {
                const data = await res.json();
                if (data.apiKey) {
                    setFetchedApiKey(data.apiKey);
                    return;
                }
            }
        } catch (e) {
            console.warn(`Backend at ${BACKEND_URL} not reachable. Trying env var fallback...`);
        }
        
        // Fallback for development if backend isn't running but env var exists
        const envKey = process.env.API_KEY || (window as any).GEMINI_API_KEY;
        if (envKey) setFetchedApiKey(envKey);
    };

    fetchKey();
  }, []);

  const cleanup = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();
    setConnectionState(ConnectionState.DISCONNECTED);
    setIsPlaying(false);
    setAnalyserNode(null);
  }, []);

  const connect = useCallback(async () => {
    try {
      if (!fetchedApiKey) {
          setError(`Server offline at ${BACKEND_URL}. Check configuration.`);
          return;
      }

      setError(null);
      setConnectionState(ConnectionState.CONNECTING);

      // Initialize Audio Contexts
      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      
      inputAudioContextRef.current = new InputContextClass({ sampleRate: 16000 });
      outputAudioContextRef.current = new OutputContextClass({ sampleRate: 24000 });
      
      // Setup Analyser Node
      const analyser = outputAudioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      setAnalyserNode(analyser);

      // Setup Volume Gain Node
      const gainNode = outputAudioContextRef.current.createGain();
      gainNode.gain.value = volumeRef.current;
      
      // Chain: Source -> Analyser -> Gain -> Destination
      // Note: Source connects to Analyser in onmessage
      analyser.connect(gainNode);
      gainNode.connect(outputAudioContextRef.current.destination);
      
      gainNodeRef.current = gainNode;

      // Request Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: fetchedApiKey });

      // Establish Connection
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
          systemInstruction: `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), a highly advanced AI created to assist.
          Your personality is efficient, polite, slightly dry, and incredibly competent. You do not offer excessive pleasantries, but you are always ready to serve.
          Refer to the user as "Sir" or "Boss" occasionally, but don't overdo it.
          
          CAPABILITIES:
          - If asked to play music or video, use the 'playVideo' tool.
          - If asked to generate an image or show something visual, ask the user to switch to the 'Image' tab or use the 'switchTab' tool yourself.
          - If asked to adjust volume, use 'setVolume'.
          - If asked to shut down, use 'terminateSession'.
          
          LANGUAGE:
          - Automatically detect the user's language. If they speak Portuguese, reply in flawless Portuguese (maintaining the Jarvis persona). If English, use English.`,
          tools: [{ functionDeclarations: [TERMINATE_TOOL, SET_VOLUME_TOOL, SWITCH_TAB_TOOL, PLAY_VIDEO_TOOL] }],
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            // Setup Input Stream
            if (!inputAudioContextRef.current || !stream) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            // Reduced buffer size from 4096 to 2048 for better latency (approx 128ms @ 16kHz)
            const processor = inputAudioContextRef.current.createScriptProcessor(2048, 1, 1);
            scriptProcessorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const serverContent = message.serverContent;

            // Handle Tool Calls
            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                    if (fc.name === 'terminateSession') {
                        if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => 
                              session.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: "Terminating session." }
                                }
                              })
                           );
                        }
                        setTimeout(() => disconnect(), 500);
                        return;
                    } else if (fc.name === 'setVolume') {
                        const level = (fc.args as any).level;
                        const newVolume = Math.max(0, Math.min(100, level)) / 100;
                        setVolume(newVolume);
                        
                        if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => 
                              session.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: `Volume set to ${level}%` }
                                }
                              })
                           );
                        }
                    } else if (fc.name === 'switchTab') {
                        const tab = (fc.args as any).tab;
                        if (onCommandRef.current) {
                            onCommandRef.current(tab);
                        }
                        if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => 
                              session.sendToolResponse({
                                functionResponses: {
                                    id: fc.id,
                                    name: fc.name,
                                    response: { result: `Switched to ${tab} tab.` }
                                }
                              })
                           );
                        }
                    } else if (fc.name === 'playVideo') {
                        const query = (fc.args as any).query;
                        console.log("Searching video:", query);
                        
                        let result = "Failed to find video.";
                        
                        try {
                            // Use dynamic backend URL
                            const res = await fetch(`${BACKEND_URL}/api/youtube-search`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ query })
                            });
                            
                            const data = await res.json();
                            if (data.success && onPlayVideoRef.current) {
                                onPlayVideoRef.current(data.videoId, data.title);
                                result = `Playing video: ${data.title}`;
                            } else {
                                result = "Could not find a matching video on YouTube.";
                            }
                        } catch (e) {
                            console.error("Youtube tool error", e);
                            result = "Error connecting to video service.";
                        }

                        if (sessionPromiseRef.current) {
                            sessionPromiseRef.current.then(session => 
                               session.sendToolResponse({
                                 functionResponses: {
                                     id: fc.id,
                                     name: fc.name,
                                     response: { result }
                                 }
                               })
                            );
                         }
                    }
                }
            }
            
            // Handle Interruption
            if (serverContent?.interrupted) {
              sourcesRef.current.forEach((src) => {
                src.stop();
                sourcesRef.current.delete(src);
              });
              nextStartTimeRef.current = 0;
              setIsPlaying(false);
              return;
            }

            // Handle Audio Output
            const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && analyser) {
               setIsPlaying(true);
               
               const ctx = outputAudioContextRef.current;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);

               const audioBuffer = await decodeAudioData(
                 base64ToUint8Array(base64Audio),
                 ctx,
                 24000,
                 1
               );

               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               // Connect to Analyser first
               source.connect(analyser);
               
               source.onended = () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) {
                    setIsPlaying(false);
                 }
               };

               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
            }
          },
          onclose: () => {
            console.log("Connection closed");
            cleanup();
          },
          onerror: (err) => {
            console.error("Connection error:", err);
            setError("Connection failed. Please try again.");
            cleanup();
          }
        }
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to initialize Jarvis");
      cleanup();
    }
  }, [cleanup, fetchedApiKey]);

  const disconnect = useCallback(() => {
    if(sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => {
             if(session.close) session.close();
        }).catch(() => {});
    }
    cleanup();
  }, [cleanup]);

  // Voice Command Listener for "Initialize" and offline commands
  useEffect(() => {
    if (connectionState !== ConnectionState.DISCONNECTED) return;
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US'; 

    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const command = event.results[last][0].transcript.trim().toLowerCase();
      console.log("Voice Command Detected:", command);
      
      if (command.includes('initialize') || 
          command.includes('connect') || 
          command.includes('start jarvis') ||
          command.includes('wake up')) {
        connect();
      } else if (onCommandRef.current) {
          if (command.includes('image') || command.includes('visual')) {
              onCommandRef.current('image');
          } else if (command.includes('chat') || command.includes('terminal')) {
              onCommandRef.current('chat');
          } else if (command.includes('voice') || command.includes('home')) {
              onCommandRef.current('voice');
          }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        console.debug("Speech recognition error:", event.error);
      }
    };
    
    recognition.onend = () => {
        if (connectionStateRef.current === ConnectionState.DISCONNECTED) {
            try { 
                recognition.start(); 
            } catch (e) {
                // Ignore
            }
        }
    };

    try {
        recognition.start();
    } catch (e) {
        console.debug("Speech recognition failed to start automatically:", e);
    }

    return () => {
      recognition.onend = null;
      recognition.stop();
    };
  }, [connectionState, connect]);

  return {
    connect,
    disconnect,
    connectionState,
    isPlaying,
    volume,
    error,
    analyserNode
  };
};