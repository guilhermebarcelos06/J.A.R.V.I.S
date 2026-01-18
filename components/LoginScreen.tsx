import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Scan, ShieldCheck, ShieldAlert, Fingerprint, ChevronRight } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (userId: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'granted' | 'denied'>('idle');
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    let interval: number;
    if (status === 'scanning') {
      interval = window.setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) return 100;
          return prev + 2;
        });
      }, 30);
    } else {
      setScanProgress(0);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setStatus('scanning');

    // Simulate biometric scan delay
    setTimeout(() => {
      // Hardcoded credentials for demo
      if (username.toLowerCase() === 'admin' && password.toLowerCase() === 'jarvis') {
        setStatus('granted');
        setTimeout(() => onLogin('local-admin'), 1500);
      } else {
        setStatus('denied');
        setTimeout(() => setStatus('idle'), 2000);
      }
    }, 2000);
  };

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden z-50">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:50px_50px] opacity-20"></div>

      {/* Main Card */}
      <div className="relative w-full max-w-md p-8 m-4">
        {/* Borders */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500"></div>

        <div className="bg-black/60 backdrop-blur-md border border-cyan-900/50 p-8 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-hidden">
          
          {/* Scanning Line Animation */}
          {status === 'scanning' && (
             <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
          )}

          <div className="flex flex-col items-center mb-8">
            <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-4 transition-all duration-500 relative
                ${status === 'granted' ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 
                  status === 'denied' ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 
                  'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]'}`}>
                
                {status === 'idle' && <Lock className="text-cyan-400" size={32} />}
                {status === 'scanning' && <Scan className="text-cyan-400 animate-pulse" size={32} />}
                {status === 'granted' && <ShieldCheck className="text-green-400" size={32} />}
                {status === 'denied' && <ShieldAlert className="text-red-400" size={32} />}
                
                {/* Spinning Rings */}
                {status === 'scanning' && (
                    <div className="absolute inset-0 rounded-full border border-cyan-500/30 border-t-cyan-400 animate-spin"></div>
                )}
            </div>
            
            <h1 className="text-2xl font-bold tracking-[0.3em] text-cyan-500 uppercase">J.A.R.V.I.S.</h1>
            <p className="text-[10px] text-cyan-800 tracking-widest mt-2 uppercase">Secure Access Terminal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-cyan-700 font-mono pl-1">Identity</label>
              <div className="relative group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={status !== 'idle' && status !== 'denied'}
                  className="w-full bg-black/50 border border-cyan-900/50 rounded p-3 pl-10 text-cyan-100 placeholder-cyan-900/50 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all font-mono text-sm tracking-wider"
                  placeholder="USERNAME"
                />
                <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-800 group-focus-within:text-cyan-500 transition-colors" size={16} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-cyan-700 font-mono pl-1">Passcode</label>
              <div className="relative group">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={status !== 'idle' && status !== 'denied'}
                  className="w-full bg-black/50 border border-cyan-900/50 rounded p-3 pl-10 text-cyan-100 placeholder-cyan-900/50 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all font-mono text-sm tracking-wider"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-800 group-focus-within:text-cyan-500 transition-colors" size={16} />
              </div>
            </div>

            {status === 'denied' && (
                <div className="text-red-500 text-xs font-mono text-center bg-red-950/20 border border-red-900/50 p-2 rounded animate-pulse">
                    ACCESS DENIED: INVALID CREDENTIALS
                </div>
            )}

            <button
              type="submit"
              disabled={status !== 'idle' && status !== 'denied'}
              className={`w-full py-3 rounded font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 border
                ${status === 'granted' 
                    ? 'bg-green-500/20 border-green-500 text-green-400' 
                    : 'bg-cyan-900/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                }
              `}
            >
              {status === 'idle' || status === 'denied' ? (
                  <>
                    <span>Initiate Sequence</span>
                    <ChevronRight size={16} />
                  </>
              ) : status === 'scanning' ? (
                  <span className="animate-pulse">Verifying... {scanProgress}%</span>
              ) : (
                  <span>Access Granted</span>
              )}
            </button>
          </form>

          {/* Decorative tech lines */}
          <div className="absolute bottom-4 right-4 flex gap-1">
             <div className="w-1 h-1 bg-cyan-600 rounded-full animate-pulse"></div>
             <div className="w-1 h-1 bg-cyan-600 rounded-full animate-pulse delay-75"></div>
             <div className="w-1 h-1 bg-cyan-600 rounded-full animate-pulse delay-150"></div>
          </div>
        </div>
      </div>
      
       <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};