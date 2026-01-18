import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Cpu, User, MessageSquareText, Sparkles, Download, Maximize2, X } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
    activeTab: 'text' | 'image';
    onTabChange: (tab: 'text' | 'image') => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ activeTab, onTabChange }) => {
  const { messages, sendMessage, generateImage, isLoading } = useChat();
  const [inputValue, setInputValue] = useState('');
  const [selectedImage, setSelectedImage] = useState<{url: string, timestamp: number} | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter messages for specific views
  const textMessages = messages.filter(m => !m.image && (m.role === 'model' ? !m.text?.includes('Visual rendering') : !m.text?.startsWith('Generate image:')));
  const imageMessages = messages.filter(m => m.image);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, activeTab]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    if (activeTab === 'image') {
      generateImage(inputValue);
    } else {
      sendMessage(inputValue);
    }
    setInputValue('');
  };

  const handleDownload = (imageUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Lightbox Modal */}
      {selectedImage && (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200"
            onClick={() => setSelectedImage(null)}
        >
            <div 
                className="relative max-w-7xl w-full h-full flex flex-col items-center justify-center pointer-events-none"
            >
                {/* Image Container */}
                <div 
                    className="relative pointer-events-auto border border-purple-500/30 rounded-lg overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.15)] bg-black/50"
                    onClick={(e) => e.stopPropagation()}
                >
                    <img 
                        src={selectedImage.url} 
                        alt="Full Resolution Output" 
                        className="max-h-[85vh] max-w-full object-contain" 
                    />
                    
                    {/* Lightbox Controls */}
                    <div className="absolute top-4 right-4 flex gap-2">
                         <button 
                            onClick={() => handleDownload(selectedImage.url, `jarvis_visual_${selectedImage.timestamp}.png`)}
                            className="p-2 bg-black/60 hover:bg-purple-900/60 text-purple-200 rounded-full border border-purple-500/30 backdrop-blur-md transition-all group"
                            title="Download"
                        >
                            <Download size={20} className="group-hover:scale-110 transition-transform"/>
                        </button>
                        <button 
                            onClick={() => setSelectedImage(null)}
                            className="p-2 bg-black/60 hover:bg-red-900/60 text-red-200 rounded-full border border-red-500/30 backdrop-blur-md transition-all group"
                            title="Close"
                        >
                            <X size={20} className="group-hover:scale-110 transition-transform"/>
                        </button>
                    </div>

                    {/* Footer Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                        <div className="flex items-center gap-2 text-purple-300/60 font-mono text-xs tracking-widest uppercase">
                            <Sparkles size={12} />
                            <span>VISUAL_ID: {selectedImage.timestamp} // RENDER_COMPLETE</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}

      <div className="w-full max-w-3xl h-[650px] flex flex-col bg-black/40 backdrop-blur-md border border-cyan-500/30 rounded-lg overflow-hidden relative shadow-[0_0_40px_rgba(6,182,212,0.1)]">
        
        {/* Decorative Header Lines */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent"></div>
        
        {/* Tabs */}
        <div className="flex items-center border-b border-cyan-900/30 bg-black/40">
          <button
            onClick={() => onTabChange('text')}
            className={`flex-1 py-3 text-xs font-bold tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 ${
              activeTab === 'text' 
                ? 'bg-cyan-500/10 text-cyan-400 border-b-2 border-cyan-500 shadow-[0_10px_20px_-10px_rgba(6,182,212,0.2)]' 
                : 'text-cyan-900/60 hover:text-cyan-500 hover:bg-cyan-500/5'
            }`}
          >
            <MessageSquareText size={14} />
            Command Line
          </button>
          <div className="w-[1px] h-6 bg-cyan-900/30"></div>
          <button
            onClick={() => onTabChange('image')}
            className={`flex-1 py-3 text-xs font-bold tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 ${
              activeTab === 'image' 
                ? 'bg-purple-500/10 text-purple-400 border-b-2 border-purple-500 shadow-[0_10px_20px_-10px_rgba(168,85,247,0.2)]' 
                : 'text-cyan-900/60 hover:text-purple-400 hover:bg-purple-500/5'
            }`}
          >
            <Sparkles size={14} />
            Visual Synthesis
          </button>
        </div>

        {/* Content Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-cyan-900/50 scrollbar-track-transparent bg-gradient-to-b from-black/20 to-transparent"
        >
          {/* TEXT MODE VIEW */}
          {activeTab === 'text' && (
            <div className="space-y-4">
              {textMessages.length === 0 && (
                  <div className="h-[400px] flex flex-col items-center justify-center text-cyan-900/50 font-mono text-sm tracking-widest uppercase">
                    <Cpu size={48} className="mb-4 opacity-50" />
                    <p>Terminal Link Established</p>
                    <p className="text-[10px] mt-2">Ready for text input...</p>
                  </div>
                )}
              
              {textMessages.map((msg) => (
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
                      <p className="text-sm font-light leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                      <div className={`absolute w-2 h-2 border-t border-l ${msg.role === 'user' ? 'border-cyan-600 top-0 left-0' : 'border-cyan-400 top-0 right-0'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                    </div>
                  </div>
              ))}
            </div>
          )}

          {/* IMAGE MODE VIEW */}
          {activeTab === 'image' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {imageMessages.length === 0 && !isLoading && (
                  <div className="col-span-full h-[400px] flex flex-col items-center justify-center text-purple-900/50 font-mono text-sm tracking-widest uppercase">
                    <ImageIcon size={48} className="mb-4 opacity-50" />
                    <p>Visual Matrix Empty</p>
                    <p className="text-[10px] mt-2">Enter prompt to generate visuals...</p>
                  </div>
                )}

              {imageMessages.map((msg) => (
                  <div 
                      key={msg.id} 
                      className="relative group rounded-lg overflow-hidden border border-purple-500/30 bg-black/60 shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:border-purple-500/60 transition-all cursor-pointer"
                      onClick={() => msg.image && setSelectedImage({url: msg.image, timestamp: msg.timestamp})}
                  >
                      {msg.image && (
                          <div className="relative aspect-square">
                            <img src={msg.image} alt="Generated Content" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-4">
                                <div className="flex items-end justify-between gap-3">
                                  <p className="text-xs text-purple-200 font-mono line-clamp-3 opacity-90">
                                    {messages.find(m => m.timestamp < msg.timestamp && m.role === 'user' && m.text?.startsWith('Generate image:'))?.text?.replace('Generate image: ', '') || 'Generated Visual'}
                                  </p>
                                  <div className="flex gap-2">
                                      <button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              msg.image && setSelectedImage({url: msg.image, timestamp: msg.timestamp});
                                          }}
                                          className="shrink-0 p-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 hover:text-purple-100 rounded-lg border border-purple-500/30 backdrop-blur-md transition-all"
                                          title="Maximize"
                                      >
                                          <Maximize2 size={16} />
                                      </button>
                                      <button
                                          onClick={(e) => {
                                              e.stopPropagation();
                                              msg.image && handleDownload(msg.image, `jarvis_visual_${msg.timestamp}.png`);
                                          }}
                                          className="shrink-0 p-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-200 hover:text-purple-100 rounded-lg border border-purple-500/30 backdrop-blur-md transition-all"
                                          title="Download Output"
                                      >
                                          <Download size={16} />
                                      </button>
                                  </div>
                                </div>
                            </div>
                          </div>
                      )}
                      <div className="absolute top-2 right-2 px-2 py-1 bg-black/70 rounded text-[10px] text-purple-400 font-mono uppercase border border-purple-500/30 pointer-events-none">
                          Generated
                      </div>
                  </div>
              ))}
            </div>
          )}

          {isLoading && (
              <div className={`flex justify-start mt-4 ${activeTab === 'image' ? 'col-span-full' : ''}`}>
                  <div className={`bg-black/60 border rounded p-3 ${activeTab === 'image' ? 'border-purple-500/20' : 'border-cyan-500/20'}`}>
                      <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${activeTab === 'image' ? 'bg-purple-400' : 'bg-cyan-400'}`}></div>
                          <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-75 ${activeTab === 'image' ? 'bg-purple-400' : 'bg-cyan-400'}`}></div>
                          <div className={`w-1.5 h-1.5 rounded-full animate-bounce delay-150 ${activeTab === 'image' ? 'bg-purple-400' : 'bg-cyan-400'}`}></div>
                          <span className={`text-xs font-mono ml-2 animate-pulse ${activeTab === 'image' ? 'text-purple-400' : 'text-cyan-400'}`}>
                              {activeTab === 'image' ? 'RENDERING...' : 'PROCESSING...'}
                          </span>
                      </div>
                  </div>
              </div>
          )}
        </div>

        {/* Input Area */}
        <div className={`p-4 bg-black/60 border-t backdrop-blur-md ${activeTab === 'image' ? 'border-purple-900/30' : 'border-cyan-900/30'}`}>
          <form onSubmit={handleSubmit} className="relative flex items-end gap-2">
            <div className="flex-1 relative">
              <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={activeTab === 'image' ? "Enter prompt to generate visual..." : "Enter command..."}
                  className={`w-full bg-black/50 border rounded p-3 pl-4 text-cyan-50 placeholder-gray-600 focus:outline-none focus:shadow-[0_0_15px_rgba(0,0,0,0.5)] transition-all font-mono text-sm
                      ${activeTab === 'image' 
                          ? 'border-purple-900/50 focus:border-purple-500/50' 
                          : 'border-cyan-900/50 focus:border-cyan-500/50'}
                  `}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className={`p-3 rounded border transition-all disabled:opacity-30 disabled:cursor-not-allowed
                  ${activeTab === 'image'
                      ? 'bg-purple-900/20 border-purple-500/30 text-purple-400 hover:bg-purple-500/20 hover:text-purple-200'
                      : 'bg-cyan-900/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 hover:text-cyan-200'}
              `}
            >
              {activeTab === 'image' ? <Sparkles size={20} /> : <Send size={20} />}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};