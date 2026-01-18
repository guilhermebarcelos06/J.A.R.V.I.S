import React, { useEffect, useRef } from 'react';
import { ConnectionState } from '../types';

interface ArcReactorProps {
  state: ConnectionState;
  isPlaying: boolean;
  analyserNode?: AnalyserNode | null;
}

export const ArcReactor: React.FC<ArcReactorProps> = ({ state, isPlaying, analyserNode }) => {
  const isConnected = state === ConnectionState.CONNECTED;
  const isError = state === ConnectionState.ERROR;
  const isListening = isConnected && !isPlaying;

  // Refs for direct DOM manipulation (Performance optimization)
  const avatarRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);

  // Audio Reactivity Loop
  useEffect(() => {
    if (!analyserNode || !isPlaying || !isConnected) {
        // Reset transforms when not playing
        if (avatarRef.current) {
            avatarRef.current.style.transform = 'scale(1)';
            avatarRef.current.style.opacity = '1';
        }
        return;
    }

    let rafId: number;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const animate = () => {
        analyserNode.getByteFrequencyData(dataArray);

        // Calculate average volume for speech range (lower frequencies usually)
        let sum = 0;
        const binCount = Math.floor(bufferLength * 0.7); // Use 70% of bins
        for (let i = 0; i < binCount; i++) {
            sum += dataArray[i];
        }
        const average = sum / binCount;
        
        // Normalize (0-255 -> 0-1)
        const intensity = average / 255;

        // Apply transforms
        if (avatarRef.current) {
            // Scale: 1.0 -> 1.4 based on volume
            const scale = 1 + (intensity * 0.4);
            // Opacity: 0.6 -> 1.0
            const opacity = 0.6 + (intensity * 0.4);
            
            avatarRef.current.style.transform = `scale(${scale})`;
            avatarRef.current.style.opacity = `${opacity}`;
        }

        rafId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
        cancelAnimationFrame(rafId);
    };
  }, [analyserNode, isPlaying, isConnected]);

  // Colors
  const glowColor = isError ? 'shadow-red-500' : 'shadow-cyan-400';
  const ringColor = isError ? 'border-red-500' : 'border-cyan-400';
  const coreColor = isError ? 'bg-red-500' : 'bg-cyan-100';
  const listenRingColor = isError ? 'border-red-400/30' : 'border-cyan-400/30';
  const avatarColor = isError ? 'border-red-400' : 'border-cyan-400';
  const avatarGlow = isError ? 'bg-red-400' : 'bg-cyan-400';

  return (
    <div className="relative flex items-center justify-center w-64 h-64">
      {/* Speaking Avatar - Holographic Projection */}
      {/* Positioned above the reactor, fades in when speaking */}
      <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-8 flex flex-col items-center transition-all duration-500 ease-out z-20 ${isPlaying ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        
        {/* The Reactive Avatar Container */}
        <div ref={avatarRef} className="relative w-24 h-24 flex items-center justify-center transition-transform duration-75 will-change-transform">
            {/* Spinning Outer Shells */}
            <div className={`absolute inset-0 border ${avatarColor} opacity-30 rounded-full animate-[spin_3s_linear_infinite]`}></div>
            <div className={`absolute inset-2 border-x ${avatarColor} opacity-40 rounded-full animate-[spin_5s_linear_infinite_reverse]`}></div>
            
            {/* Geometric Core (Rotated Squares) */}
            <div className={`absolute w-12 h-12 border ${avatarColor} opacity-60 rotate-45`}></div>
            <div className={`absolute w-12 h-12 border ${avatarColor} opacity-30 rotate-[22.5deg]`}></div>
            <div className={`absolute w-12 h-12 border ${avatarColor} opacity-30 rotate-[67.5deg]`}></div>

            {/* Inner Glowing Nucleus */}
            <div className={`w-3 h-3 ${avatarGlow} rounded-full shadow-[0_0_20px_5px_currentColor]`}></div>
            
            {/* Scanning particles */}
            <div className={`absolute inset-0 rounded-full border-t border-transparent ${avatarColor} opacity-40 animate-spin`}></div>
        </div>

        {/* Connecting Data Stream Beam */}
        <div className={`w-[1px] h-12 bg-gradient-to-b from-${isError ? 'red' : 'cyan'}-400/0 via-${isError ? 'red' : 'cyan'}-400/50 to-${isError ? 'red' : 'cyan'}-400/0 opacity-50`}></div>
      </div>

      {/* Outer Pulse Ring - Active only when connected */}
      {isConnected && (
        <div className={`absolute w-full h-full rounded-full animate-pulse-ring ${isPlaying ? 'scale-150 opacity-40' : 'scale-100 opacity-20'}`}></div>
      )}

      {/* Main Container */}
      <div className={`relative flex items-center justify-center w-48 h-48 rounded-full border-2 ${ringColor} bg-black/80 backdrop-blur-sm shadow-[0_0_30px_rgba(0,0,0,0.5)] ${glowColor} transition-all duration-500 animate-float`}>
        
        {/* Rotating Outer Ring */}
        <div className={`absolute w-44 h-44 rounded-full border border-dashed border-gray-600 ${isConnected ? 'animate-[spin_10s_linear_infinite]' : ''}`}></div>
        
        {/* Inner Ring */}
        <div className={`absolute w-36 h-36 rounded-full border-2 ${ringColor} opacity-50 shadow-[0_0_15px_inset] ${glowColor}`}></div>

        {/* Listening Indicator Ring - Visible only when listening */}
        <div className={`absolute w-28 h-28 rounded-full border-2 border-dashed ${listenRingColor} transition-all duration-500 ${isListening ? 'opacity-100 animate-[spin_4s_linear_infinite]' : 'opacity-0 scale-90'}`}></div>

        {/* The Core */}
        <div ref={coreRef} className={`relative w-16 h-16 rounded-full ${coreColor} shadow-[0_0_50px_10px] ${glowColor} transition-all duration-300 ${isPlaying ? 'scale-125 brightness-150' : (isListening ? 'scale-100 animate-pulse' : 'scale-100')}`}>
          <div className="absolute inset-0 bg-white opacity-50 blur-sm rounded-full animate-pulse"></div>
        </div>
        
        {/* Tech decorative lines */}
        <div className="absolute top-0 w-1 h-4 bg-gray-500/50"></div>
        <div className="absolute bottom-0 w-1 h-4 bg-gray-500/50"></div>
        <div className="absolute left-0 h-1 w-4 bg-gray-500/50"></div>
        <div className="absolute right-0 h-1 w-4 bg-gray-500/50"></div>
      </div>
    </div>
  );
};