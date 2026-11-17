import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, AlertCircle, X, KeyRound } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (admin: { username: string; token: string }) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset fields to completely blank whenever the authentication window opens
  React.useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setShowPassword(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser) {
      setErrorMessage('Please enter Admin username');
      return;
    }
    if (!cleanPass) {
      setErrorMessage('Please enter Admin password');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        onSuccess({
          username: data.username || cleanUser,
          token: data.token || 'admin_token',
        });
        onClose();
      } else {
        setErrorMessage(data.message || 'Invalid Admin username or password');
      }
    } catch {
      // Local fallback
      try {
        const stored = localStorage.getItem('wkt_admin_creds');
        const creds = stored ? JSON.parse(stored) : { username: 'Admin', password: 'MissingWiki' };
        if (
          cleanUser.toLowerCase() === String(creds.username).toLowerCase() &&
          cleanPass === String(creds.password)
        ) {
          onSuccess({ username: creds.username, token: 'local_token' });
          onClose();
          return;
        }
      } catch {}

      if (cleanUser.toLowerCase() === 'admin' && cleanPass === 'MissingWiki') {
        onSuccess({ username: 'Admin', token: 'default_token' });
        onClose();
        return;
      }

      setErrorMessage('Invalid Admin username or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm bg-[#240630] border-2 border-[#6b21a8] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#16041c] border-b border-[#581c87]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-300">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                Admin Authentication
              </h2>
              <p className="text-[11px] text-purple-300">
                Sign in to manage authorized streamers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-purple-300 hover:text-white hover:bg-purple-900/50 transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-purple-200 mb-1.5">
              Admin User
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full bg-[#16041c] border border-purple-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-purple-400/60 focus:outline-none focus:border-amber-400 transition"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-purple-200 mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-[#16041c] border border-purple-700/80 rounded-xl pl-3 pr-10 py-2 text-xs text-white placeholder-purple-400/60 focus:outline-none focus:border-amber-400 transition"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2 text-purple-300 hover:text-purple-100 transition p-1"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-purple-300 hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-amber-400 hover:bg-amber-300 active:scale-[0.98] text-[#2d0938] rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-400/20 disabled:opacity-50"
            >
              {loading ? (
                <span>Checking...</span>
              ) : (
                <>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Log In to Admin</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
