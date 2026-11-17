import React, { useState } from 'react';
import { Key, Lock, Eye, EyeOff, Radio, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { getOrInitTabSessionId } from '../utils/session';

interface StreamerLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (auth: { username: string; key: string; label?: string; sessionId?: string }) => void;
  initialUsername?: string;
}

export const StreamerLoginModal: React.FC<StreamerLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialUsername = '',
}) => {
  const [username, setUsername] = useState(() => {
    if (initialUsername) {
      return initialUsername.startsWith('@') ? initialUsername : `@${initialUsername}`;
    }
    return '@';
  });
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Autofill @ and reset key and error message whenever the login window opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialUsername) {
        setUsername(initialUsername.startsWith('@') ? initialUsername : `@${initialUsername}`);
      } else {
        setUsername('@');
      }
      setKey('');
      setShowKey(false);
      setErrorMessage(null);
    }
  }, [isOpen, initialUsername]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Keep @ at the start at all times
    if (!val.startsWith('@')) {
      val = '@' + val.replace(/^@*/, '');
    }
    setUsername(val);
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().replace(/^@/, '').toLowerCase();
    const cleanKey = key.trim();

    if (!cleanUser) {
      setErrorMessage('Please enter your TikTok @username');
      return;
    }
    if (!cleanKey) {
      setErrorMessage('Please enter your admin-provided streamer key');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const tabSessionId = getOrInitTabSessionId();
      const res = await fetch('/api/auth/validate-streamer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          key: cleanKey,
          sessionId: tabSessionId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.valid) {
        onSuccess({
          username: cleanUser,
          key: cleanKey,
          label: data.user?.label,
          sessionId: data.sessionId || tabSessionId,
        });
        onClose();
      } else {
        setErrorMessage(
          data.message ||
            (res.status === 409
              ? `@${cleanUser} is already logged in on another device or window.`
              : 'Invalid username or key. Please check your credentials or contact the administrator.')
        );
      }
    } catch (err: any) {
      // Local fallback verification against localStorage backup if server is offline
      try {
        const stored = localStorage.getItem('wkt_authorized_streamers_backup');
        if (stored) {
          const list = JSON.parse(stored);
          const found = list.find(
            (u: any) =>
              String(u.username).trim().toLowerCase() === cleanUser &&
              String(u.key).trim() === cleanKey
          );
          if (found) {
            onSuccess({
              username: cleanUser,
              key: cleanKey,
              label: found.label,
            });
            onClose();
            return;
          }
        }
      } catch {}

      setErrorMessage(
        'Authentication failed. Please verify your @username and access key.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#240630] border-2 border-[#6b21a8] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-[#16041c] border-b border-[#581c87]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/35 flex items-center justify-center text-amber-300">
              <Radio className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide">
                TikTok Streamer Login
              </h2>
              <p className="text-[11px] text-purple-300">
                Authorized access required to connect TikTok Live
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
              TikTok Account
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={handleUsernameChange}
                placeholder="@username"
                className="w-full bg-[#16041c] border border-purple-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-purple-400/60 focus:outline-none focus:border-amber-400 transition font-mono"
                autoComplete="off"
                autoFocus
              />
            </div>
            <p className="text-[10px] text-purple-300/75 mt-1">
              The TikTok handle that is streaming live (e.g. @yourstream)
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-purple-200 mb-1.5">
              Admin-Provided Access Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="LIVE-XXXX-XXXX"
                className="w-full bg-[#16041c] border border-purple-700/80 rounded-xl pl-3 pr-10 py-2 text-xs text-white placeholder-purple-400/60 font-mono focus:outline-none focus:border-amber-400 transition"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2 text-purple-300 hover:text-purple-100 transition p-1"
                title={showKey ? 'Hide key' : 'Show key'}
              >
                {showKey ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-purple-300/75 mt-1">
              Your secret key issued by the game administrator
            </p>
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
                <span>Verifying...</span>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5" />
                  <span>Verify &amp; Open Live</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="px-5 py-3 bg-[#16041c] border-t border-[#581c87] text-[10px] text-purple-300/80 text-center">
          Need a key? Ask the room administrator to add your @username.
        </div>
      </div>
    </div>
  );
};
