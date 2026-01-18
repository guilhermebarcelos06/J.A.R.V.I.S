import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, downsampleBuffer } from '../utils/audioUtils';

// Determine Backend URL
const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('jarvis_backend_url');
        if (local) return local.replace(/\/$/, '');
    }
    return ((import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
};
const BACKEND_URL = getBackendUrl();

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
  description: "Switches the application interface tab.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      tab: {
        type: Type.STRING,
        enum: ['voice', 'chat', 'image']
      },
    },
    required: ["tab"],
  },
};

const PLAY_VIDEO_TOOL: FunctionDeclaration = {
  name: "playVideo",
  description: "Searches and plays a video from YouTube.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search query for the video.",
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
  const [volume, setVolume] = useState(0.5); 
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
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(volume, outputAudioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [volume]);

  // Fetch API Key
  useEffect(() => {
    const fetchKey = async (retries = 3) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/config`);
            if (res.ok) {
                const data = await res.json();
                if (data.apiKey) {
                    setFetchedApiKey(data.apiKey);
                    return;
                }
            }
        } catch (e) {
            console.warn(`Backend check failed. Retries left: ${retries}`);
            if (retries > 0) setTimeout(() => fetchKey(retries - 1), 2000);
            else {
                const envKey = process.env.API_KEY || (window as any).GEMINI_API_KEY;
                if (envKey) setFetchedApiKey(envKey);
            }
        }
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
          setError(`System Offline. Backend unreachable.`);
          return;
      }

      setError(null);
      setConnectionState(ConnectionState.CONNECTING);

      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      
      // DO NOT force 16000Hz here. Let browser choose native rate to avoid glitches.
      // We will downsample manually later.
      inputAudioContextRef.current = new InputContextClass();
      outputAudioContextRef.current = new OutputContextClass({ sampleRate: 24000 });

      // Resume Contexts immediately (browsers block autoplay)
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();
      
      const analyser = outputAudioContextRef.current.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      setAnalyserNode(analyser);

      const gainNode = outputAudioContextRef.current.createGain();
      gainNode.gain.value = volumeRef.current;
      analyser.connect(gainNode);
      gainNode.connect(outputAudioContextRef.current.destination);
      gainNodeRef.current = gainNode;

      // Get Microphone Stream (Use default settings for max compatibility)
      const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
          } 
      });
      mediaStreamRef.current = stream;

      const ai = new GoogleGenAI({ apiKey: fetchedApiKey });

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
          },
          systemInstruction: `You are Jarvis. Intelligent, concise, witty.
          Respond in the user's language (Portuguese/English).
          Keep answers short unless asked for detail.
          Use tools for volume, tabs, or video.
          Never disconnect unless explicitly told to 'shutdown'.`,
          tools: [{ functionDeclarations: [SET_VOLUME_TOOL, SWITCH_TAB_TOOL, PLAY_VIDEO_TOOL] }],
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            console.log("Link Established");
            
            if (!inputAudioContextRef.current || !stream) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            const inputSampleRate = inputAudioContextRef.current.sampleRate;
            console.log(`Mic Sample Rate: ${inputSampleRate}Hz. Downsampling to 16000Hz.`);

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              
              // CRITICAL: Downsample to 16kHz before sending
              const downsampledData = downsampleBuffer(inputData, inputSampleRate, 16000);
              const pcmBlob = createPcmBlob(downsampledData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch (err) {
                    // Ignore send errors if closing
                  }
                });
              }
            };

            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const serverContent = message.serverContent;

            if (message.toolCall) {
                for (const fc of message.toolCall.functionCalls) {
                     if (fc.name === 'setVolume') {
                        const level = (fc.args as any).level;
                        const newVolume = Math.max(0, Math.min(100, level)) / 100;
                        setVolume(newVolume);
                        if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "OK" } } }));
                        }
                    } else if (fc.name === 'switchTab') {
                        const tab = (fc.args as any).tab;
                        if (onCommandRef.current) onCommandRef.current(tab);
                        if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "OK" } } }));
                        }
                    } else if (fc.name === 'playVideo') {
                        const query = (fc.args as any).query;
                        let result = "Error";
                        try {
                            const res = await fetch(`${BACKEND_URL}/api/youtube-search`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query })
                            });
                            const data = await res.json();
                            if (data.success && onPlayVideoRef.current) {
                                onPlayVideoRef.current(data.videoId, data.title);
                                result = "Playing";
                            }
                        } catch (e) { console.error(e); }
                        if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
                        }
                    }
                }
            }
            
            if (serverContent?.interrupted) {
              sourcesRef.current.forEach((src) => { src.stop(); sourcesRef.current.delete(src); });
              nextStartTimeRef.current = 0;
              setIsPlaying(false);
              return;
            }

            const base64Audio = serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && analyser) {
               setIsPlaying(true);
               const ctx = outputAudioContextRef.current;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), ctx, 24000, 1);
               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(analyser);
               source.onended = () => {
                 sourcesRef.current.delete(source);
                 if (sourcesRef.current.size === 0) setIsPlaying(false);
               };
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               sourcesRef.current.add(source);
            }
          },
          onclose: (e) => {
            console.log("Session Closed", e);
            if (connectionStateRef.current === ConnectionState.CONNECTED) {
                 // Only cleanup if we expected to stay connected
                 setConnectionState(ConnectionState.DISCONNECTED);
                 cleanup();
            }
          },
          onerror: (err) => {
            console.error("Session Error:", err);
            setError("Connection disrupted.");
            cleanup();
          }
        }
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Initialization Failed");
      cleanup();
    }
  }, [cleanup, fetchedApiKey]);

  const disconnect = useCallback(() => {
    if(sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => { if(session.close) session.close(); }).catch(() => {});
    }
    cleanup();
  }, [cleanup]);

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
      if (command.includes('initialize') || command.includes('jarvis')) connect();
    };
    try { recognition.start(); } catch (e) {}
    return () => { recognition.onend = null; recognition.stop(); };
  }, [connectionState, connect]);

  return { connect, disconnect, connectionState, isPlaying, volume, error, analyserNode };
};