import React, { useState } from 'react';
import { useJarvis } from './hooks/useJarvis';
import { ArcReactor } from './components/ArcReactor';
import { ChatInterface } from './components/ChatInterface';
import { LoginScreen } from './components/LoginScreen';
import { ConnectionState } from './types';
import { Mic, MicOff, AlertCircle, Command, Volume2, MessageSquare, Activity, Sparkles, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<'voice' | 'chat'>('voice');
  const [chatMode, setChatMode] = useState<'text' | 'image'>('text');

  const handleCommand = (command: string) => {
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
  };

  const { connect, disconnect, connectionState, isPlaying, volume, error, analyserNode } = useJarvis({ onCommand: handleCommand });

  const handleToggleConnection = () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
      disconnect();
    } else {
      connect();
    }
  };

  const handleLogout = () => {
      disconnect();
      setIsAuthenticated(false);
  };

  const isConnected = connectionState === ConnectionState.CONNECTED;

  if (!isAuthenticated) {
      return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-neutral-950 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black flex flex-col items-center font-sans text-cyan-50 relative overflow-hidden animate-in fade-in duration-1000">
      
      {/* Background Grid Decoration */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.03)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

      {/* Header */}
      <div className="w-full flex items-center justify-between px-8 py-6 z-10 border-b border-cyan-900/20 bg-black/20 backdrop-blur-sm">
        <div className="text-left">
            <h1 className="text-2xl font-bold tracking-[0.2em] text-cyan-500 uppercase drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
            J.A.R.V.I.S.
            </h1>
            <p className="text-[10px] text-cyan-700 tracking-widest mt-1">SYSTEM ONLINE // PROTOCOL GEMINI-LIVE</p>
        </div>

        {/* Tab Navigation & Logout */}
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-cyan-900/30">
                <button 
                    onClick={() => setActiveTab('voice')}
                    className={`px-4 py-2 rounded text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === 'voice' ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-900 hover:text-cyan-500'}`}
                >
                    <Activity size={14} />
                    Voice Link
                </button>
                <button 
                    onClick={() => { setActiveTab('chat'); setChatMode('text'); }}
                    className={`px-4 py-2 rounded text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${activeTab === 'chat' ? 'bg-cyan-500/20 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-cyan-900 hover:text-cyan-500'}`}
                >
                    <MessageSquare size={14} />
                    Terminal
                </button>
            </div>

            <button 
                onClick={handleLogout}
                className="p-2 rounded-lg border border-red-900/30 text-red-900/60 hover:text-red-400 hover:bg-red-900/20 hover:border-red-500/50 transition-all"
                title="Disconnect/Logout"
            >
                <LogOut size={16} />
            </button>
        </div>
      </div>

      {/* Main Interface Content */}
      <div className="flex-1 w-full flex flex-col items-center justify-center p-8 z-10">
        
        {activeTab === 'voice' && (
          <div className="flex flex-col items-center gap-12 animate-in fade-in zoom-in duration-500">
            <div className="relative">
              <ArcReactor state={connectionState} isPlaying={isPlaying} analyserNode={analyserNode} />
            </div>

            {/* Status Text */}
            <div className="h-20 flex flex-col items-center justify-center gap-2">
              {error ? (
                <div className="flex items-center gap-2 text-red-500 bg-red-950/30 px-4 py-2 rounded-full border border-red-900/50 backdrop-blur-sm">
                  <AlertCircle size={16} />
                  <span className="text-sm font-mono">{error}</span>
                </div>
              ) : (
                <>
                  <p className={`text-lg font-light tracking-wide transition-colors duration-300 ${isConnected ? 'text-cyan-400' : 'text-gray-400'} ${isPlaying ? 'text-cyan-200 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : ''}`}>
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
                          <div className="flex items-center gap-2 text-cyan-900/60">
                              <Sparkles size={10} />
                              <span>Say "Switch to Image Generator"</span>
                          </div>
                          <div className="flex items-center gap-2 text-red-900/60">
                              <Command size={10} />
                              <span>Say "Terminate" to stop</span>
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
                group relative px-8 py-4 rounded-full font-bold tracking-wider transition-all duration-300 flex items-center gap-3
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
             <div className="absolute bottom-8 right-8 flex items-center gap-2 text-cyan-800/60 font-mono text-xs">
                <Volume2 size={14} />
                <span>VOL: {Math.round(volume * 100)}%</span>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
             <div className="w-full flex justify-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                <ChatInterface activeTab={chatMode} onTabChange={setChatMode} />
             </div>
        )}

      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-0 right-0 text-center text-cyan-900/40 text-[10px] font-mono pointer-events-none">
        <p>GEMINI 2.5 FLASH AUDIO PREVIEW | GEMINI 2.5 FLASH IMAGE | GEMINI 3 FLASH TEXT</p>
      </div>
    </div>
  );
};

export default App;