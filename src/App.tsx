import React, { useState, useCallback } from 'react';
import { useJarvis } from './hooks/useJarvis';
import { ArcReactor } from './components/ArcReactor';
import { ChatInterface } from './components/ChatInterface';
import { LoginScreen } from './components/LoginScreen';
import { ConnectionState } from './types';
import { Mic, MicOff, AlertCircle, Command, Volume2, MessageSquare, Activity, Sparkles, LogOut, X, Youtube, Settings, Server, Key } from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'voice' | 'chat'>('voice');
  const [chatMode, setChatMode] = useState<'text' | 'image'>('text');
  const [videoData, setVideoData] = useState<{id: string, title: string} | null>(null);

  // Optimization: Wrap handlers in useCallback to maintain stable references
  const handleCommand = useCallback((command: string) => {
      console.log("Handling command:", command);
      if (command === 'voice') {
          setActiveTab('voice');
      } else if (command === 'chat') {
          setActiveTab('chat');
          setChatMode('text');
      } else if (command === 'image') {
          setActiveTab('chat');
          setChatMode('image');
      }
  }, []);

  const handlePlayVideo = useCallback((videoId: string, title: string) => {
      setVideoData({ id: videoId, title });
  }, []);

  const { 
      connect, 
      disconnect, 
      connectionState, 
      isPlaying, 
      volume, 
      error, 
      analyserNode,
      isBackendConnected,
      isApiKeyReady
  } = useJarvis({ 
      onCommand: handleCommand,
      onPlayVideo: handlePlayVideo,
      enabled: isAuthenticated
  });

  const handleToggleConnection = useCallback(() => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      disconnect();
    } else {
      connect();
    }
  }, [connectionState, connect, disconnect]);

  const handleLogin = (id: string) => {
      setUserId(id);
      setIsAuthenticated(true);
  };

  const handleLogout = useCallback(() => {
      disconnect();
      setUserId(undefined);
      setIsAuthenticated(false);
  }, [disconnect]);

  const handleResetConnection = useCallback(() => {
      if (window.confirm("Reset server connection settings? This will reload the application.")) {
          localStorage.removeItem('jarvis_backend_url');
          window.location.reload();
      }
  }, []);

  const isConnected = connectionState === ConnectionState.CONNECTED;

  if (!isAuthenticated) {
      return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    // Main Container - Uses h-[100dvh] for mobile browser compatibility (handles address bar resizing)
    <div className="h-[100dvh] w-full bg-neutral-950 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black flex flex-col font-sans text-cyan-50 relative overflow-hidden animate-in fade-in duration-1000 touch-none">
      
      {/* Background Grid Decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {/* Floating Video Player Overlay */}
      {videoData && (
          <div className="absolute top-20 right-4 z-50 w-80 md:w-96 bg-black/80 border border-cyan-500/50 rounded-lg overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-md animate-in fade-in slide-in-from-right-10 duration-500">
              <div className="flex items-center justify-between p-2 bg-gradient-to-r from-cyan-900/50 to-transparent border-b border-cyan-500/30">
                  <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
                      <Youtube size={14} />
                      <span className="truncate max-w-[200px]">{videoData.title}</span>
                  </div>
                  <button 
                      onClick={() => setVideoData(null)}
                      className="p-1 hover:text-red-400 text-cyan-600 transition-colors"
                  >
                      <X size={16} />
                  </button>
              </div>
              <div className="aspect-video w-full bg-black">
                  <iframe 
                      width="100%" 
                      height="100%" 
                      src={`https://www.youtube.com/embed/${videoData.id}?autoplay=1&playsinline=1`}
                      title="YouTube video player" 
                      frameBorder="0" 
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                      allowFullScreen
                  ></iframe>
              </div>
              <div className="h-1 w-full bg-cyan-900/30 overflow-hidden">
                   <div className="h-full bg-cyan-500/50 w-full animate-progress-indeterminate"></div>
              </div>
          </div>
      )}

      {/* Header - Fixed Height */}
      <div className="w-full flex items-center justify-between px-4 md:px-8 py-4 z-10 border-b border-cyan-900/20 bg-black/20 backdrop-blur-sm shrink-0">
        <div className="text-left">
            <h1 className="text-xl md:text-2xl font-bold tracking-[0.2em] text-cyan-500 uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            J.A.R.V.I.S.
            </h1>
            <p className="hidden md:block text-[10px] text-cyan-700 tracking-widest mt-1">SYSTEM ONLINE // PROTOCOL GEMINI-LIVE</p>
        </div>

        {/* Tab Navigation & Status & Logout */}
        <div className="flex items-center gap-2 md:gap-4">
            
            {/* STATUS INDICATORS - Made more visible */}
            <div className="flex flex-col items-end mr-2 gap-1.5">
                 <div className={`flex items-center gap-1.5 text-[9px] md:text-[10px] font-mono tracking-wider transition-all duration-500 px-2 py-0.5 rounded ${isBackendConnected ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                    <Server size={10} className={isBackendConnected ? '' : 'animate-pulse'} />
                    <span className="hidden sm:inline">{isBackendConnected ? 'MAINFRAME: ON' : 'MAINFRAME: OFF'}</span>
                    <span className="sm:hidden">SRV</span>
                 </div>
                 <div className={`flex items-center gap-1.5 text-[9px] md:text-[10px] font-mono tracking-wider transition-all duration-500 px-2 py-0.5 rounded ${isApiKeyReady ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-red-900/30 text-red-400 border border-red-500/30'}`}>
                    <Key size={10} className={isApiKeyReady ? '' : 'animate-pulse'} />
                    <span className="hidden sm:inline">{isApiKeyReady ? 'KEY: SECURE' : 'KEY: MISSING'}</span>
                    <span className="sm:hidden">KEY</span>
                 </div>
            </div>

            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-cyan-900/30">
                <button 
                    onClick={() => setActiveTab('voice')}
                    className={`px-3 py-2 md:px-4 md:py-2 rounded text-[10px] md:text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === 'voice' ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-900 hover:text-cyan-500'}`}
                >
                    <Activity size={14} />
                    <span className="hidden md:inline">Voice Link</span>
                </button>
                <button 
                    onClick={() => { setActiveTab('chat'); setChatMode('text'); }}
                    className={`px-3 py-2 md:px-4 md:py-2 rounded text-[10px] md:text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-900 hover:text-cyan-500'}`}
                >
                    <MessageSquare size={14} />
                    <span className="hidden md:inline">Terminal</span>
                </button>
            </div>
            
            <div className="h-8 w-[1px] bg-cyan-900/30 mx-1 hidden sm:block"></div>

             <button 
                onClick={handleResetConnection}
                className="hidden sm:block p-2 rounded-lg border border-cyan-900/30 text-cyan-900/60 hover:text-cyan-400 hover:bg-cyan-900/20 hover:border-cyan-500/50 transition-all"
                title="Connection Settings"
            >
                <Settings size={16} />
            </button>

            <button 
                onClick={handleLogout}
                className="p-2 rounded-lg border border-red-900/30 text-red-900/60 hover:text-red-400 hover:bg-red-900/20 hover:border-red-500/50 transition-all"
                title="Disconnect/Logout"
            >
                <LogOut size={16} />
            </button>
        </div>
      </div>

      {/* Main Interface Content - Flex Grow to fill space */}
      <div className="flex-1 w-full flex flex-col items-center justify-center p-4 md:p-8 z-10 overflow-hidden relative">
        
        {activeTab === 'voice' && (
          <div className="flex flex-col items-center justify-center h-full w-full gap-8 md:gap-12 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <ArcReactor state={connectionState} isPlaying={isPlaying} analyserNode={analyserNode} />
            </div>

            {/* Status Text */}
            <div className="h-16 flex flex-col items-center justify-center gap-2">
              {error ? (
                <div className="flex flex-col items-center gap-2 animate-pulse">
                    <div className="flex items-center gap-2 text-red-500 bg-red-950/30 px-4 py-2 rounded-full border border-red-900/50 backdrop-blur-sm max-w-[90vw] text-center">
                      <AlertCircle size={16} className="shrink-0" />
                      <span className="text-xs md:text-sm font-mono truncate">{error}</span>
                    </div>
                    {/* Suggest checking settings if error persists */}
                    <button 
                        onClick={handleResetConnection}
                        className="text-[10px] text-cyan-700 hover:text-cyan-400 underline decoration-dashed underline-offset-4"
                    >
                        Check Connection Settings
                    </button>
                </div>
              ) : (
                <>
                  <p className={`text-base md:text-lg font-light tracking-wide transition-colors duration-300 ${isConnected ? 'text-cyan-400' : 'text-gray-400'} ${isPlaying ? 'text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : ''}`}>
                    {connectionState === ConnectionState.CONNECTED 
                      ? (isPlaying ? "SPEAKING..." : "LISTENING...") 
                      : connectionState === ConnectionState.CONNECTING 
                          ? "INITIALIZING..." 
                          : "STANDBY"}
                  </p>
                  
                  {/* Voice Command Hints */}
                  <div className="text-[10px] uppercase tracking-[0.2em] text-cyan-800 flex flex-col items-center gap-1">
                      {connectionState === ConnectionState.DISCONNECTED ? (
                        <div className="flex items-center gap-2 animate-pulse">
                            <Command size={10} />
                            <span>Say "Initialize" to start</span>
                        </div>
                      ) : connectionState === ConnectionState.CONNECTED ? (
                        <div className="flex flex-col items-center gap-1">
                          <div className="hidden md:flex items-center gap-2 text-cyan-900/60">
                              <Sparkles size={10} />
                              <span>Say "Switch to Image Generator"</span>
                          </div>
                        </div>
                      ) : null}
                  </div>
                </>
              )}
            </div>

            {/* Control Button */}
            <button
              onClick={handleToggleConnection}
              disabled={connectionState === ConnectionState.CONNECTING}
              className={`
                group relative px-6 py-3 md:px-8 md:py-4 rounded-full font-bold tracking-wider transition-all duration-300 flex items-center gap-3
                ${connectionState === ConnectionState.CONNECTED 
                  ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]' 
                  : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.3)]'}
              `}
            >
              {connectionState === ConnectionState.CONNECTED ? (
                <>
                  <MicOff size={20} />
                  <span>TERMINATE</span>
                </>
              ) : (
                <>
                  <Mic size={20} />
                  <span>INITIALIZE</span>
                </>
              )}
              
              {/* Button Borders/Decoration */}
              <div className="absolute inset-0 rounded-full border-2 border-white/5 pointer-events-none"></div>
            </button>
            
            {/* Volume Indicator */}
             <div className="absolute bottom-4 right-4 md:bottom-8 md:right-8 flex items-center gap-2 text-cyan-800/60 font-mono text-xs">
                <Volume2 size={14} />
                <span>VOL: {Math.round(volume * 100)}%</span>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
             <div className="w-full h-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ChatInterface activeTab={chatMode} onTabChange={setChatMode} userId={userId} />
             </div>
        )}

      </div>

      {/* Footer */}
      <div className="w-full text-center py-2 text-cyan-900/40 text-[8px] md:text-[10px] font-mono pointer-events-none border-t border-cyan-900/10 bg-black/20 shrink-0">
        <p>GEMINI 2.5 FLASH AUDIO PREVIEW | GEMINI 2.5 FLASH IMAGE | GEMINI 3 FLASH TEXT</p>
      </div>
    </div>
  );
};

export default App;