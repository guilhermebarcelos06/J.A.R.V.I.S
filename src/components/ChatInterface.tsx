import React, { useState, useRef, useEffect } from 'react';
import { Send, Cpu, User, MessageSquareText } from 'lucide-react';
import { useChat } from '../hooks/useChat';

interface ChatInterfaceProps {
    // Keeping props structure for compatibility but ignoring unused ones
    activeTab: 'text';
    onTabChange: (tab: 'text') => void;
    userId?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ userId }) => {
  const { messages, sendMessage, isLoading } = useChat(userId);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    sendMessage(inputValue);
    setInputValue('');
  };

  return (
    <>
      {/* Main Chat Container - Responsive Height */}
      <div className="w-full max-w-3xl flex-1 min-h-0 flex flex-col bg-black/40 backdrop-blur-md border border-cyan-500/30 rounded-lg overflow-hidden relative shadow-[0_0_40px_rgba(6,182,212,0.1)]">
        
        {/* Decorative Header Lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        
        {/* Header Title (Replaces Tabs) */}
        <div className="flex items-center border-b border-cyan-900/30 bg-black/40 shrink-0 py-3 justify-center">
             <div className="text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase text-cyan-400 flex items-center gap-2">
                 <MessageSquareText size={14} />
                 <span>Command Line Interface</span>
             </div>
        </div>

        {/* Content Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-cyan-900/50 scrollbar-track-transparent bg-gradient-to-b from-black/20 to-transparent"
        >
            <div className="space-y-4">
              {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-cyan-900/50 font-mono text-sm tracking-widest uppercase min-h-[200px]">
                    <Cpu size={48} className="mb-4 opacity-50" />
                    <p>Terminal Link Established</p>
                    <p className="text-[10px] mt-2">Ready for command input...</p>
                  </div>
                )}
              
              {messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] rounded p-3 relative group backdrop-blur-sm ${
                      msg.role === 'user' 
                        ? 'bg-cyan-950/40 border border-cyan-800/30 text-cyan-100' 
                        : 'bg-black/60 border border-cyan-500/20 text-cyan-50'
                    }`}>
                      <div className={`flex items-center gap-2 mb-1 text-[10px] uppercase tracking-wider font-mono ${msg.role === 'user' ? 'text-cyan-400' : 'text-cyan-600'}`}>
                        {msg.role === 'user' ? <User size={10} /> : <Cpu size={10} />}
                        <span>{msg.role === 'user' ? 'COMMAND' : 'J.A.R.V.I.S'}</span>
                      </div>
                      <p className="text-sm font-light leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                      <div className={`absolute w-2 h-2 border-t border-l ${msg.role === 'user' ? 'border-cyan-600 top-0 left-0' : 'border-cyan-400 top-0 right-0'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                    </div>
                  </div>
              ))}
            </div>

          {isLoading && (
              <div className="flex justify-start mt-4">
                  <div className="bg-black/60 border rounded p-3 border-cyan-500/20">
                      <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce bg-cyan-400"></div>
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce delay-75 bg-cyan-400"></div>
                          <div className="w-1.5 h-1.5 rounded-full animate-bounce delay-150 bg-cyan-400"></div>
                          <span className="text-xs font-mono ml-2 animate-pulse text-cyan-400">
                              PROCESSING...
                          </span>
                      </div>
                  </div>
              </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-black/60 border-t backdrop-blur-md shrink-0 border-cyan-900/30">
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Enter command..."
                  className="w-full bg-black/50 border rounded p-3 pl-4 text-cyan-50 placeholder-gray-600 focus:outline-none focus:shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all font-mono text-sm border-cyan-900/50 focus:border-cyan-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="p-3 rounded border transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-cyan-900/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-200"
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </>
  );
};