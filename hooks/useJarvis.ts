import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

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

interface UseJarvisProps {
    onCommand?: (command: string) => void;
}

export const useJarvis = ({ onCommand }: UseJarvisProps = {}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5); // Default 50%
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

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

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
      onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    volumeRef.current = volume;
    // Update active gain node if it exists
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(volume, outputAudioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [volume]);

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

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      // Establish Connection
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
          systemInstruction: `You are Jarvis, a sophisticated, intelligent, and highly capable AI assistant. 
          Your voice is calm, witty, and concise. You are helpful and precise.
          Respond in Portuguese if the user speaks Portuguese, otherwise use English.
          If the user wants to adjust volume, use the setVolume tool. 0 is silent, 100 is max.
          If the user asks to terminate or disconnect, use the terminateSession tool immediately.
          If the user asks to see the chat, terminal, images, or image generator, use the switchTab tool.`,
          tools: [{ functionDeclarations: [TERMINATE_TOOL, SET_VOLUME_TOOL, SWITCH_TAB_TOOL] }],
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            // Setup Input Stream
            if (!inputAudioContextRef.current || !stream) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
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
  }, [cleanup]);

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