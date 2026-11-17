import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Plus, Trash2, KeyRound, Save, CheckCircle2 } from 'lucide-react';

interface AdminUserRow {
  username: string;
  key: string;
  online?: boolean;
}

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  // Always ensure admin username and password fields are blank when opened
  const [loginUser, setLoginUser] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Admin management state once authenticated
  const [newAdminUser, setNewAdminUser] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [usersList, setUsersList] = useState<AdminUserRow[]>([]);
  const [addHandle, setAddHandle] = useState('@');
  const [addKey, setAddKey] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Reset fields to blank every time the modal opens
  useEffect(() => {
    if (isOpen) {
      setLoginUser('');
      setLoginPassword('');
      setIsAuthenticated(false);
      setAuthError(null);
      setSaveMessage(null);
      setAddHandle('@');
      setAddKey('');
    }
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: loginUser,
          password: loginPassword,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setIsAuthenticated(true);
        setNewAdminUser(loginUser);
        setNewAdminPassword(loginPassword);
        setUsersList(data.authorizedUsers || []);
        const formatted = (data.authorizedUsers || [])
          .map((u: AdminUserRow) => `${u.username}:${u.key}`)
          .join('\n');
        setBulkText(formatted);
      } else {
        setAuthError(data.error || 'Invalid credentials');
      }
    } catch (_) {
      setAuthError('Server error verifying Admin credentials.');
    }
  };

  const handleHandleInputChange = (val: string) => {
    if (!val.startsWith('@')) {
      setAddHandle('@' + val.replace(/^@+/, ''));
    } else {
      setAddHandle(val);
    }
  };

  const handleAddUserRow = () => {
    const clean = addHandle.replace(/^@+/, '').trim();
    const k = addKey.trim();
    if (!clean || !k) return;
    const formattedHandle = `@${clean}`;
    const updated = [
      ...usersList.filter((u) => u.username.toLowerCase() !== formattedHandle.toLowerCase()),
      { username: formattedHandle, key: k },
    ];
    setUsersList(updated);
    setBulkText(updated.map((u) => `${u.username}:${u.key}`).join('\n'));
    setAddHandle('@');
    setAddKey('');
  };

  const handleRemoveUser = (username: string) => {
    const updated = usersList.filter((u) => u.username !== username);
    setUsersList(updated);
    setBulkText(updated.map((u) => `${u.username}:${u.key}`).join('\n'));
  };

  const handleBulkTextChange = (txt: string) => {
    setBulkText(txt);
    const parsed: AdminUserRow[] = [];
    for (const line of txt.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const parts = trimmed.split(/[:,\s]+/);
      if (parts.length >= 2) {
        const rawU = parts[0].replace(/^@+/, '').trim();
        const rawK = parts.slice(1).join('').trim();
        if (rawU && rawK) {
          parsed.push({ username: `@${rawU}`, key: rawK });
        }
      }
    }
    setUsersList(parsed);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMessage(null);
    try {
      const res = await fetch('/api/admin/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentUsername: loginUser,
          currentPassword: loginPassword,
          newUsername: newAdminUser,
          newPassword: newAdminPassword,
          usersList,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setLoginUser(newAdminUser);
        setLoginPassword(newAdminPassword);
        setUsersList(data.authorizedUsers || []);
        setSaveMessage('Authorised users and Admin credentials saved.');
      } else {
        setAuthError(data.error || 'Failed to save changes.');
      }
    } catch (_) {
      setAuthError('Error saving admin configuration.');
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Admin Portal"
    >
      <div
        className="w-full max-w-[490px] rounded-2xl bg-[#240630] border-2 border-[#facc15] shadow-[0_0_32px_rgba(250,204,21,0.25)] text-[#faf5ff] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#6b21a8]/60 bg-[#2c0938]">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[#facc15]" />
            <div>
              <h2 className="text-base font-bold tracking-tight">Admin Portal</h2>
              <p className="text-[11px] text-[#d8b4fe]">
                Authorised TikTok Streamers &amp; Access Keys
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-xs font-semibold bg-[#360b42] hover:bg-[#6b21a8] text-white transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {!isAuthenticated ? (
            <form onSubmit={handleAdminLogin} autoComplete="off" className="space-y-4">
              <p className="text-xs text-[#f3e8ff]">
                Enter Admin credentials to manage authorised TikTok Live users and individual keys.
              </p>

              {authError && (
                <div className="p-2.5 rounded-xl bg-red-950/70 border border-red-500/60 text-red-200 text-xs">
                  {authError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#d8b4fe] mb-1">
                  Admin User
                </label>
                <input
                  type="text"
                  value={loginUser}
                  onChange={(e) => setLoginUser(e.target.value)}
                  autoComplete="off"
                  placeholder="Enter Admin username"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#16041c] border border-[#6b21a8] text-sm text-white focus:outline-none focus:border-[#facc15]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#d8b4fe] mb-1">
                  Admin Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Enter Admin password"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#16041c] border border-[#6b21a8] text-sm text-white focus:outline-none focus:border-[#facc15]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#facc15] hover:bg-[#fde047] text-[#2d0938] text-xs font-extrabold cursor-pointer"
              >
                Sign In to Admin Panel
              </button>
            </form>
          ) : (
            <form onSubmit={handleSaveChanges} className="space-y-4">
              {saveMessage && (
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-[#4ade80] text-[#4ade80] text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              )}

              {/* Add Single Authorised User + Key */}
              <div className="p-3.5 rounded-xl bg-[#2c0938] border border-[#6b21a8] space-y-2.5">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[#facc15]" /> Add Authorised @Username &amp; Key
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={addHandle}
                    onChange={(e) => handleHandleInputChange(e.target.value)}
                    placeholder="@username"
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[#16041c] border border-[#6b21a8] text-xs text-white focus:outline-none focus:border-[#facc15]"
                  />
                  <input
                    type="text"
                    value={addKey}
                    onChange={(e) => setAddKey(e.target.value)}
                    placeholder="Individual Key"
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-[#16041c] border border-[#6b21a8] text-xs text-white focus:outline-none focus:border-[#facc15]"
                  />
                  <button
                    type="button"
                    onClick={handleAddUserRow}
                    className="px-3 py-1.5 rounded-lg bg-[#4ade80] text-[#2d0938] text-xs font-extrabold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* Authorised Users List */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#f3e8ff]">
                  Authorised Users List (one per line: <code className="text-[#facc15]">@username:key</code>)
                </label>
                <textarea
                  rows={4}
                  value={bulkText}
                  onChange={(e) => handleBulkTextChange(e.target.value)}
                  placeholder="@mrdimpz:secretkey1&#10;@creator2:secretkey2"
                  className="w-full p-3 rounded-xl bg-[#16041c] border border-[#6b21a8] text-xs font-mono text-white focus:outline-none focus:border-[#facc15]"
                />
              </div>

              {/* Current Active Entries Table */}
              {usersList.length > 0 && (
                <div className="rounded-xl bg-[#16041c] border border-[#6b21a8]/60 divide-y divide-[#6b21a8]/30 max-h-36 overflow-y-auto">
                  {usersList.map((u) => (
                    <div
                      key={u.username}
                      className="px-3 py-2 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-[#facc15]">{u.username}</span>
                        <span className="text-[#d8b4fe] font-mono">Key: {u.key}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveUser(u.username)}
                        className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                        title="Remove user"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Change Admin Username & Password */}
              <div className="p-3.5 rounded-xl bg-[#2c0938] border border-[#6b21a8] space-y-2.5">
                <div className="text-xs font-bold text-white">
                  Update Admin Login Credentials
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] text-[#d8b4fe] mb-1">
                      Admin Username
                    </label>
                    <input
                      type="text"
                      value={newAdminUser}
                      onChange={(e) => setNewAdminUser(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#16041c] border border-[#6b21a8] text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-[#d8b4fe] mb-1">
                      Admin Password
                    </label>
                    <input
                      type="text"
                      value={newAdminPassword}
                      onChange={(e) => setNewAdminPassword(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[#16041c] border border-[#6b21a8] text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#facc15] hover:bg-[#fde047] text-[#2d0938] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save className="w-4 h-4" /> Save Authorised Users &amp; Admin Settings
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
