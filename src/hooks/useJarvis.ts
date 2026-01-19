import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration, Type } from '@google/genai';
import { ConnectionState } from '../types';
import { createPcmBlob, decodeAudioData, base64ToUint8Array, downsampleBuffer } from '../utils/audioUtils';

// Determine Backend URL - Default to production if local not set
const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('jarvis_backend_url');
        if (local) return local.replace(/\/$/, '');
    }
    // Prioritize production URL default
    return ((import.meta as any).env?.VITE_BACKEND_URL || 'https://jarvis-backend-w3sx.onrender.com').replace(/\/$/, '');
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
        enum: ['voice', 'chat']
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

const RESIZE_VIDEO_TOOL: FunctionDeclaration = {
  name: "resizeVideo",
  description: "Resizes the video player window.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      size: {
        type: Type.STRING,
        enum: ['small', 'large'],
        description: "The target size: 'small' (default/minimized) or 'large' (expanded/theater mode).",
      },
    },
    required: ["size"],
  },
};

const CONTROL_MEDIA_TOOL: FunctionDeclaration = {
  name: "controlMedia",
  description: "Controls the media playback (pause, play, rewind, forward, close).",
  parameters: {
    type: Type.OBJECT,
    properties: {
      action: {
        type: Type.STRING,
        enum: ['pause', 'play', 'rewind', 'forward', 'stop', 'close'],
        description: "The action to perform. 'close' removes the video player entirely.",
      },
    },
    required: ["action"],
  },
};

const TERMINATE_SESSION_TOOL: FunctionDeclaration = {
  name: "terminateSession",
  description: "Ends the voice session and disconnects the microphone.",
};

interface UseJarvisProps {
    onCommand?: (command: string) => void;
    onPlayVideo?: (videoId: string, title: string) => void;
    onResizeVideo?: (size: 'small' | 'large') => void;
    onControlMedia?: (action: 'pause' | 'play' | 'rewind' | 'forward' | 'stop' | 'close') => void;
    enabled?: boolean;
}

export const useJarvis = ({ onCommand, onPlayVideo, onResizeVideo, onControlMedia, enabled = true }: UseJarvisProps = {}) => {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5); 
  const [error, setError] = useState<string | null>(null);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [fetchedApiKey, setFetchedApiKey] = useState<string | null>(null);
  
  // Status Indicators
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<'checking' | 'valid' | 'invalid' | 'leaked'>('checking');

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
  const onResizeVideoRef = useRef(onResizeVideo);
  const onControlMediaRef = useRef(onControlMedia);

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
      onResizeVideoRef.current = onResizeVideo;
  }, [onResizeVideo]);

  useEffect(() => {
      onControlMediaRef.current = onControlMedia;
  }, [onControlMedia]);

  useEffect(() => {
    volumeRef.current = volume;
    if (gainNodeRef.current) {
        gainNodeRef.current.gain.setTargetAtTime(volume, outputAudioContextRef.current?.currentTime || 0, 0.1);
    }
  }, [volume]);

  // HELPER: Verify any key
  const verifyKey = async (key: string) => {
      try {
          const ai = new GoogleGenAI({ apiKey: key });
          await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: { parts: [{ text: '' }] }
          });
          setFetchedApiKey(key);
          setIsApiKeyReady(true);
          setApiKeyStatus('valid');
          return true;
      } catch (verifyErr: any) {
          console.error("API Key Verification Failed:", verifyErr);
          setIsApiKeyReady(false);
          setFetchedApiKey(key); 
          
          const errMsg = verifyErr.message || verifyErr.toString();

          if (errMsg.includes('leaked') || errMsg.includes('PERMISSION_DENIED')) {
              setApiKeyStatus('leaked');
          } 
          // CRITICAL FIX: Treat 429/Resource Exhausted as a VALID key, just rate limited.
          else if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED')) {
              console.warn("Quota exceeded (429), but key is authenticated. Proceeding as valid.");
              setIsApiKeyReady(true);
              setApiKeyStatus('valid');
              return true;
          }
          else {
              setApiKeyStatus('invalid');
          }
          return false;
      }
  };

  // Fetch API Key
  useEffect(() => {
    if (!enabled) return;

    const fetchKey = async (retries = 10) => {
        try {
            const res = await fetch(`${BACKEND_URL}/api/config`);
            if (res.ok) {
                const data = await res.json();
                if (data.apiKey) {
                    setIsBackendConnected(true);
                    await verifyKey(data.apiKey);
                    return;
                }
            }
            throw new Error("No key in response");
        } catch (e) {
            setIsBackendConnected(false);
            if (retries > 0) {
                setTimeout(() => fetchKey(retries - 1), 2000);
            } else {
                // Fallback to local
                const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || 
                               (import.meta as any).env?.VITE_API_KEY ||
                               (window as any).GEMINI_API_KEY;
                if (envKey) {
                    await verifyKey(envKey);
                } else {
                    setIsApiKeyReady(false);
                    setApiKeyStatus('invalid');
                }
            }
        }
    };
    fetchKey();
  }, [enabled]);

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

  const disconnect = useCallback(() => {
    if(sessionPromiseRef.current) {
        sessionPromiseRef.current.then(session => { if(session.close) session.close(); }).catch(() => {});
    }
    cleanup();
  }, [cleanup]);

  const connect = useCallback(async () => {
    try {
      if (!fetchedApiKey || apiKeyStatus !== 'valid') {
          setError(`System Halted: API Key ${apiKeyStatus.toUpperCase()}`);
          return;
      }

      setError(null);
      setConnectionState(ConnectionState.CONNECTING);

      const InputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      const OutputContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      
      inputAudioContextRef.current = new InputContextClass();
      outputAudioContextRef.current = new OutputContextClass({ sampleRate: 24000 });

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
          systemInstruction: `Você é o J.A.R.V.I.S.
          CRIAÇÃO: Você foi criado por Guilherme Silvestre Barcelos, um Desenvolvedor e Engenheiro de Software brilhante. Se perguntarem quem te criou, responda com orgulho citando o nome dele.
          
          Fale sempre em Português do Brasil. Seja conciso e leal.
          
          CAPACIDADES:
          1. Ajustar Volume: Use 'setVolume'.
          2. Navegar: Use 'switchTab' para mudar entre abas.
          3. Multimídia: Use 'playVideo' para tocar músicas/vídeos.
          4. Controle de Vídeo: Use 'controlMedia' para pausar, tocar, voltar, avançar ou fechar.
          5. Tamanho do Vídeo: Use 'resizeVideo'.
          6. SESSÃO: Use 'terminateSession' para "encerrar" ou "desligar".
          7. PESQUISA E CLIMA: Você tem acesso à ferramenta 'googleSearch'. USE-A SEMPRE que o usuário perguntar sobre o CLIMA, PREVISÃO DO TEMPO, NOTÍCIAS ou FATOS RECENTES. Não invente dados sobre o mundo real, pesquise.

          Seja breve nas respostas faladas.`,
          tools: [
              { googleSearch: {} }, 
              { functionDeclarations: [SET_VOLUME_TOOL, SWITCH_TAB_TOOL, PLAY_VIDEO_TOOL, RESIZE_VIDEO_TOOL, CONTROL_MEDIA_TOOL, TERMINATE_SESSION_TOOL] }
          ],
        },
        callbacks: {
          onopen: () => {
            setConnectionState(ConnectionState.CONNECTED);
            
            if (!inputAudioContextRef.current || !stream) return;
            
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            const inputSampleRate = inputAudioContextRef.current.sampleRate;
            console.log(`Mic Rate: ${inputSampleRate}Hz. Downsampling to 16000Hz.`);

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const downsampledData = downsampleBuffer(inputData, inputSampleRate, 16000);
              const pcmBlob = createPcmBlob(downsampledData);
              
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  try {
                    session.sendRealtimeInput({ media: pcmBlob });
                  } catch (err) { }
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
                            } else {
                                result = "NotFound";
                            }
                        } catch (e) { console.error(e); }
                        if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
                        }
                    } else if (fc.name === 'resizeVideo') {
                         const size = (fc.args as any).size;
                         if (onResizeVideoRef.current) onResizeVideoRef.current(size);
                         if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "OK" } } }));
                        }
                    } else if (fc.name === 'controlMedia') {
                         const action = (fc.args as any).action;
                         if (onControlMediaRef.current) onControlMediaRef.current(action);
                         if (sessionPromiseRef.current) {
                           sessionPromiseRef.current.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "OK" } } }));
                        }
                    } else if (fc.name === 'terminateSession') {
                         if (sessionPromiseRef.current) {
                           await sessionPromiseRef.current.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "Terminating" } } }));
                           setTimeout(() => disconnect(), 500); 
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
  }, [cleanup, fetchedApiKey, apiKeyStatus]);

  useEffect(() => {
    if (connectionState !== ConnectionState.DISCONNECTED) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'pt-BR'; 
    recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const command = event.results[last][0].transcript.trim().toLowerCase();
      if (command.includes('inicializar') || command.includes('jarvis')) connect();
    };
    try { recognition.start(); } catch (e) {}
    return () => { recognition.onend = null; recognition.stop(); };
  }, [connectionState, connect]);

  return { 
      connect, 
      disconnect, 
      connectionState, 
      isPlaying, 
      volume, 
      error, 
      analyserNode,
      isBackendConnected,
      isApiKeyReady,
      apiKeyStatus
  };
};