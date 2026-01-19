import React, { useState, useEffect } from 'react';
import { Lock, Unlock, Scan, ShieldCheck, ShieldAlert, Fingerprint, ChevronRight, UserPlus, ArrowLeft, Settings, Server, Loader2, Wifi, CheckCircle, XCircle, AlertTriangle, Key } from 'lucide-react';

// Dynamic Backend URL resolution with LocalStorage override
const getBackendUrl = () => {
    if (typeof window !== 'undefined') {
        const local = localStorage.getItem('jarvis_backend_url');
        if (local) return local.replace(/\/$/, '');
    }
    return ((import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001').replace(/\/$/, '');
};

interface LoginScreenProps {
  onLogin: (userId: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'granted' | 'denied' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [scanProgress, setScanProgress] = useState(0);

  // Connection Indicators State
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [keyStatus, setKeyStatus] = useState<'checking' | 'valid' | 'invalid' | 'leaked'>('checking');

  // Config Modal State
  const [showConfig, setShowConfig] = useState(false);
  const [configUrl, setConfigUrl] = useState(getBackendUrl());
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'fail'>('idle');
  const [testMessage, setTestMessage] = useState('');

  // Mixed Content Detection
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const targetUrl = configUrl;
  const isTargetHttp = targetUrl.startsWith('http:');
  const isMixedContent = isHttps && isTargetHttp && !targetUrl.includes('localhost');

  // Initial Health Check
  useEffect(() => {
      const checkHealth = async () => {
          const url = getBackendUrl();
          try {
              // Check Basic Connectivity
              const res = await fetch(`${url}/`, { method: 'GET' });
              if (res.ok) {
                  setServerStatus('online');
                  
                  // Check API Key via Verify Endpoint
                  try {
                    const verifyRes = await fetch(`${url}/api/verify`);
                    const verifyData = await verifyRes.json();
                    
                    if (verifyRes.ok && verifyData.success) {
                        setKeyStatus('valid');
                    } else {
                        // Backend returns 401 if key is invalid, or 500 if other error
                        if (verifyRes.status === 401 || verifyData.error?.includes('leaked')) {
                            setKeyStatus('leaked'); // Treat as leaked/invalid for UI
                        } else {
                            setKeyStatus('invalid');
                        }
                    }
                  } catch {
                      setKeyStatus('invalid');
                  }
              } else {
                  setServerStatus('offline');
                  setKeyStatus('invalid');
              }
          } catch (e) {
              setServerStatus('offline');
              // Check if we have a local key as fallback
              const envKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || (window as any).GEMINI_API_KEY;
              if (envKey) {
                   setKeyStatus('valid'); // Valid local key even if server is offline
              } else {
                   setKeyStatus('invalid');
              }
          }
      };
      checkHealth();
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    if (isMixedContent) {
        setErrorMessage('Security Block: Cannot connect to HTTP server from HTTPS site.');
        setStatus('error');
        setTimeout(() => setShowConfig(true), 1500);
        return;
    }

    setStatus('scanning');
    setErrorMessage('');

    try {
        const endpoint = isRegistering ? '/api/register' : '/api/login';
        
        // Artificial delay for UI effect
        await new Promise(resolve => setTimeout(resolve, 1500));

        const backend = getBackendUrl();
        console.log("Attempting connection to:", backend);

        // Handler for Render Cold Start (Free tier takes up to 60s to wake up)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout
        
        // Notify user if it's taking longer than usual (Cold Start)
        const wakeUpTimer = setTimeout(() => {
            if (status === 'scanning') {
                setErrorMessage("Waking up Mainframe... (Cold Start)");
            }
        }, 3000);

        const res = await fetch(`${backend}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        clearTimeout(wakeUpTimer);

        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            throw new Error(`Server Error: Received HTML instead of JSON. Check URL.`);
        }

        const data = await res.json();

        if (res.ok && data.success) {
            setStatus('granted');
            setTimeout(() => onLogin(data.userId), 1500);
        } else {
            setStatus('denied');
            setErrorMessage(data.error || 'Access Denied');
            setTimeout(() => setStatus('idle'), 2000);
        }
    } catch (err: any) {
        console.error(err);
        setStatus('error');
        
        let msg = 'Cannot reach Mainframe';
        if (err.name === 'AbortError') msg = 'Connection Timed Out. Server sleeping?';
        else if (err.message.includes('Failed to fetch')) msg = 'Network Error. Blocked or Offline.';
        else msg = err.message;
        
        setErrorMessage(msg);
        
        // Auto-open config on network failures
        if (msg.includes('Network') || msg.includes('HTML')) {
            setTimeout(() => setShowConfig(true), 2000);
        }
    }
  };

  const testConnection = async () => {
      setTestStatus('testing');
      setTestMessage('Verifying Uplink & API Key...');
      
      let url = configUrl.trim().replace(/\/$/, '');
      if (!url.startsWith('http')) url = `https://${url}`;

      try {
          // Check if server is online AND if API Key is valid via /api/verify
          const res = await fetch(`${url}/api/verify`, { method: 'GET' });
          const data = await res.json().catch(() => ({}));

          if (res.ok && data.success) {
              setTestStatus('success');
              setTestMessage(data.message || 'System Online: API Key Valid');
              setServerStatus('online');
              setKeyStatus('valid');
          } else {
              setTestStatus('fail');
              setTestMessage(data.error || `Error: ${res.status} (Check Key)`);
              setServerStatus('online'); // Server is reachable but maybe error
              setKeyStatus('invalid');
          }
      } catch (e: any) {
          setTestStatus('fail');
          setTestMessage(e.message === 'Failed to fetch' ? 'Network Error / Offline' : e.message);
          setServerStatus('offline');
      }
  };

  const saveConfig = () => {
      let url = configUrl.trim().replace(/\/$/, '');
      if (!url.startsWith('http')) url = `https://${url}`;
      
      localStorage.setItem('jarvis_backend_url', url);
      setConfigUrl(url); 
      setShowConfig(false);
      setErrorMessage('');
      setStatus('idle');
      window.location.reload(); 
  };

  if (showConfig) {
      return (
        <div className="fixed inset-0 bg-black flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-300">
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black"></div>
             <div className="bg-black/90 border border-cyan-500/50 p-6 md:p-8 rounded-xl max-w-md w-full relative backdrop-blur-md shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                <h2 className="text-xl font-bold text-cyan-400 mb-6 uppercase tracking-widest flex items-center gap-2">
                    <Server size={20} />
                    System Configuration
                </h2>
                
                {isMixedContent && (
                    <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-600/50 rounded flex items-start gap-2 text-yellow-500 text-xs">
                        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                        <div>
                            <strong>Security Warning:</strong> You are using HTTPS but trying to connect to an HTTP server. This will be blocked. Change your backend to HTTPS or use Localhost.
                        </div>
                    </div>
                )}
                
                <div className="space-y-4">
                    <div>
                        <label className="text-xs text-cyan-700 uppercase font-mono mb-2 block">Mainframe URL (Backend)</label>
                        <input 
                            type="text" 
                            value={configUrl}
                            onChange={(e) => setConfigUrl(e.target.value)}
                            placeholder="https://your-app.onrender.com"
                            className="w-full bg-black/50 border border-cyan-900 rounded p-3 text-cyan-100 font-mono text-xs focus:border-cyan-400 focus:outline-none"
                        />
                        <p className="text-[10px] text-cyan-800 mt-2">
                            Enter the full URL of your Render backend (starting with https://).
                        </p>
                    </div>

                    {/* Test Results Display */}
                    <div className={`p-3 rounded border text-xs font-mono flex items-center gap-2 ${
                        testStatus === 'idle' ? 'border-gray-800 text-gray-500' :
                        testStatus === 'testing' ? 'border-cyan-800 text-cyan-400 bg-cyan-900/10' :
                        testStatus === 'success' ? 'border-green-800 text-green-400 bg-green-900/10' :
                        'border-red-800 text-red-400 bg-red-900/10'
                    }`}>
                        {testStatus === 'testing' && <Loader2 size={14} className="animate-spin" />}
                        {testStatus === 'success' && <CheckCircle size={14} />}
                        {testStatus === 'fail' && <XCircle size={14} />}
                        {testMessage || "Ready to test connection"}
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={testConnection}
                            className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs uppercase font-mono rounded flex items-center justify-center gap-2"
                        >
                            <Wifi size={14} />
                            Test Signal & Key
                        </button>
                    </div>

                    <div className="flex gap-3 mt-6 border-t border-gray-800 pt-4">
                        <button 
                            onClick={() => setShowConfig(false)}
                            className="flex-1 py-3 border border-red-900/50 text-red-500 rounded hover:bg-red-900/20 font-mono text-xs uppercase"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={saveConfig}
                            className="flex-1 py-3 bg-cyan-900/30 border border-cyan-500 text-cyan-400 rounded hover:bg-cyan-500/20 font-mono text-xs uppercase"
                        >
                            Save & Reboot
                        </button>
                    </div>
                </div>
             </div>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center overflow-hidden z-50">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black"></div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.05)_1px,transparent_1px)] bg-[size:50px_50px] opacity-20"></div>

      {/* TOP RIGHT STATUS INDICATORS */}
      <div className="absolute top-4 right-16 flex flex-col items-end gap-1 z-50 pointer-events-none">
          {/* Server Status */}
          <div className={`flex items-center gap-2 text-[10px] font-mono tracking-widest px-2 py-1 rounded border backdrop-blur-md transition-all duration-500 ${
              serverStatus === 'online' ? 'bg-green-900/20 border-green-500/30 text-green-400' : 
              serverStatus === 'offline' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
              'bg-gray-900/20 border-gray-500/30 text-gray-400'
          }`}>
              <Server size={12} className={serverStatus === 'checking' ? 'animate-pulse' : ''} />
              <span>{serverStatus === 'online' ? 'BACKEND: ON' : serverStatus === 'offline' ? 'BACKEND: OFF' : 'CONNECTING...'}</span>
          </div>
          
          {/* Key Status */}
           <div className={`flex items-center gap-2 text-[10px] font-mono tracking-widest px-2 py-1 rounded border backdrop-blur-md transition-all duration-500 ${
              keyStatus === 'valid' ? 'bg-green-900/20 border-green-500/30 text-green-400' : 
              keyStatus === 'leaked' ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' :
              keyStatus === 'invalid' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
              'bg-gray-900/20 border-gray-500/30 text-gray-400'
          }`}>
              <Key size={12} className={keyStatus === 'checking' ? 'animate-pulse' : ''} />
              <span>{
                  keyStatus === 'valid' ? 'KEY: SECURE' : 
                  keyStatus === 'leaked' ? 'KEY: LEAKED' : 
                  keyStatus === 'invalid' ? 'KEY: MISSING' : 'VERIFYING...'
              }</span>
          </div>
      </div>

      {/* Config Button (Absolute) */}
      <button 
        onClick={() => setShowConfig(true)}
        className="absolute top-4 right-4 p-2 text-cyan-900/40 hover:text-cyan-400 border border-transparent hover:border-cyan-500/30 rounded transition-all z-50 bg-black/20"
        title="System Configuration"
      >
          <Settings size={18} />
      </button>

      {/* Main Card */}
      <div className="relative w-full max-w-md p-8 m-4">
        {/* Borders */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-500"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-500"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-500"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-500"></div>

        <div className="bg-black/60 backdrop-blur-md border border-cyan-900/50 p-8 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.15)] relative overflow-hidden transition-all duration-500">
          
          {/* Scanning Line Animation */}
          {status === 'scanning' && (
             <div className="absolute top-0 left-0 w-full h-1 bg-cyan-400 shadow-[0_0_20px_rgba(6,182,212,1)] animate-[scan_2s_ease-in-out_infinite]"></div>
          )}

          <div className="flex flex-col items-center mb-8">
            <div className={`w-20 h-20 rounded-full border-2 flex items-center justify-center mb-4 transition-all duration-500 relative
                ${status === 'granted' ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 
                  (status === 'denied' || status === 'error') ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]' : 
                  'border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.3)]'}`}>
                
                {status === 'idle' && (isRegistering ? <UserPlus className="text-cyan-400" size={32} /> : <Lock className="text-cyan-400" size={32} />)}
                {status === 'scanning' && <Scan className="text-cyan-400 animate-pulse" size={32} />}
                {status === 'granted' && <ShieldCheck className="text-green-400" size={32} />}
                {(status === 'denied' || status === 'error') && <ShieldAlert className="text-red-400" size={32} />}
                
                {/* Spinning Rings */}
                {status === 'scanning' && (
                    <div className="absolute inset-0 rounded-full border border-cyan-500/30 border-t-cyan-400 animate-spin"></div>
                )}
            </div>
            
            <h1 className="text-2xl font-bold tracking-[0.3em] text-cyan-500 uppercase">J.A.R.V.I.S.</h1>
            <p className="text-[10px] text-cyan-800 tracking-widest mt-2 uppercase">
                {isRegistering ? 'New Personnel Registration' : 'Secure Access Terminal'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-wider text-cyan-700 font-mono pl-1">Identity</label>
              <div className="relative group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={status === 'scanning' || status === 'granted'}
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
                  disabled={status === 'scanning' || status === 'granted'}
                  className="w-full bg-black/50 border border-cyan-900/50 rounded p-3 pl-10 text-cyan-100 placeholder-cyan-900/50 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all font-mono text-sm tracking-wider"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-800 group-focus-within:text-cyan-500 transition-colors" size={16} />
              </div>
            </div>

            {(status === 'denied' || status === 'error') && (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="text-red-500 text-xs font-mono text-center bg-red-950/20 border border-red-900/50 p-2 rounded flex items-center justify-center gap-2">
                        {errorMessage.includes('Waking') && <Loader2 size={12} className="animate-spin" />}
                        <span className="break-words">{errorMessage}</span>
                    </div>
                    
                    <button
                        type="button"
                        onClick={() => setShowConfig(true)}
                        className="text-[10px] text-cyan-500 hover:text-cyan-300 underline decoration-dashed underline-offset-4 text-center mt-1 flex items-center justify-center gap-1"
                    >
                        <Settings size={10} />
                        Configure Server Link
                    </button>
                    {/* Display currently used URL for debugging */}
                    <div className="text-[8px] text-gray-600 text-center font-mono truncate px-4">
                        Target: {getBackendUrl()}
                    </div>
                </div>
            )}
            
            {/* Show waking message during scan if valid */}
            {status === 'scanning' && errorMessage && (
                 <div className="text-cyan-400 text-xs font-mono text-center animate-pulse mt-2 flex items-center justify-center gap-2">
                     <Loader2 size={12} className="animate-spin" />
                     {errorMessage}
                 </div>
            )}

            <button
              type="submit"
              disabled={status === 'scanning' || status === 'granted'}
              className={`w-full py-3 rounded font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 border
                ${status === 'granted' 
                    ? 'bg-green-500/20 border-green-500 text-green-400' 
                    : 'bg-cyan-900/20 border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                }
              `}
            >
              {status === 'idle' || status === 'denied' || status === 'error' ? (
                  <>
                    <span>{isRegistering ? 'Register ID' : 'Initiate Sequence'}</span>
                    <ChevronRight size={16} />
                  </>
              ) : status === 'scanning' ? (
                  <span className="animate-pulse">Processing... {scanProgress}%</span>
              ) : (
                  <span>Access Granted</span>
              )}
            </button>
          </form>

            <div className="mt-6 flex justify-center">
                <button 
                    onClick={() => {
                        setIsRegistering(!isRegistering);
                        setErrorMessage('');
                        setStatus('idle');
                    }}
                    disabled={status === 'scanning' || status === 'granted'}
                    className="text-[10px] text-cyan-800 hover:text-cyan-400 uppercase tracking-widest transition-colors flex items-center gap-1"
                >
                    {isRegistering ? (
                        <>
                           <ArrowLeft size={10} />
                           Back to Login
                        </>
                    ) : (
                        "Create New Identity"
                    )}
                </button>
            </div>

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