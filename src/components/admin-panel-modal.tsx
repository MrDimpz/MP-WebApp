import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { AdminMysqlMigrationPanel } from '@/components/admin-mysql-migration-panel';
import {
  logoutInteractiveAdmin,
  useInteractiveAuthStore,
  verifyInteractiveAdminLogin,
} from '@/lib/interactive-key-auth';
import {
  normalizeTikTokHandle,
  useRegisteredUsersDirectory,
  type RegisteredUserRecord,
} from '@/lib/unified-game-auth';

interface AdminPanelModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
}

type DirectoryFilter =
  | 'all'
  | 'no_key'
  | 'has_key'
  | 'connected'
  | 'not_connected';

interface CombinedRegisteredUser extends RegisteredUserRecord {
  streamKey: string | null;
  streamKeyLabel?: string;
}

function formatRelativeDate(ts: number): string {
  if (!ts || !Number.isFinite(ts)) return 'Recently';
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return 'Recently';
  }
}

export function RegisteredUsersDirectoryView({ enabled = true }: { enabled?: boolean }) {
  const { users, loading, refresh } = useRegisteredUsersDirectory(enabled);
  const { users: streamKeyUsers } = useInteractiveAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');

  const combinedUsers = useMemo<CombinedRegisteredUser[]>(() => {
    const keyByHandle = new Map<string, { key: string; label?: string; createdAt: number }>();
    for (const sk of streamKeyUsers) {
      const cleanHandle = normalizeTikTokHandle(sk.username || sk.displayHandle);
      if (cleanHandle) {
        keyByHandle.set(cleanHandle, {
          key: sk.key,
          label: sk.label,
          createdAt: sk.createdAt || Date.now(),
        });
      }
    }

    const matchedHandles = new Set<string>();
    const result: CombinedRegisteredUser[] = users.map((u) => {
      const cleanHandle = normalizeTikTokHandle(u.linkedTikTokHandle);
      const matchedKey = cleanHandle ? keyByHandle.get(cleanHandle) : undefined;
      if (cleanHandle && matchedKey) {
        matchedHandles.add(cleanHandle);
      }
      return {
        ...u,
        streamKey: matchedKey?.key || null,
        streamKeyLabel: matchedKey?.label,
      };
    });

    // Also include any authorized stream key accounts that haven't yet been linked to a profile row
    for (const sk of streamKeyUsers) {
      const cleanHandle = normalizeTikTokHandle(sk.username || sk.displayHandle);
      if (cleanHandle && !matchedHandles.has(cleanHandle)) {
        matchedHandles.add(cleanHandle);
        const ts = sk.createdAt || Date.now();
        result.push({
          uid: `streamkey_${sk.id || cleanHandle.replace(/^@+/, '')}`,
          displayName: sk.label || sk.username || cleanHandle.replace(/^@+/, ''),
          linkedTikTokHandle: cleanHandle,
          tiktokConnected: true,
          authProvider: 'site',
          createdAt: ts,
          updatedAt: ts,
          streamKey: sk.key,
          streamKeyLabel: sk.label,
        });
      }
    }

    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [users, streamKeyUsers]);

  const stats = useMemo(() => {
    const total = combinedUsers.length;
    const withoutKey = combinedUsers.filter((u) => !u.streamKey).length;
    const withKey = combinedUsers.filter((u) => Boolean(u.streamKey)).length;
    const connected = combinedUsers.filter((u) => u.tiktokConnected).length;
    const notConnected = total - connected;
    return { total, withoutKey, withKey, connected, notConnected };
  }, [combinedUsers]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedUsers.filter((user) => {
      if (filter === 'no_key' && user.streamKey) return false;
      if (filter === 'has_key' && !user.streamKey) return false;
      if (filter === 'connected' && !user.tiktokConnected) return false;
      if (filter === 'not_connected' && user.tiktokConnected) return false;
      if (!q) return true;
      return (
        user.displayName.toLowerCase().includes(q) ||
        user.linkedTikTokHandle.toLowerCase().includes(q) ||
        (user.streamKey && user.streamKey.toLowerCase().includes(q)) ||
        user.authProvider.toLowerCase().includes(q)
      );
    });
  }, [combinedUsers, searchQuery, filter]);

  const providerLabel = (provider: RegisteredUserRecord['authProvider']) => {
    if (provider === 'google') return 'Google · Firebase';
    if (provider === 'email') return 'Email · Firebase / Site';
    return 'Firebase / Site Account';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))',
          gap: '0.6rem',
        }}
      >
        <div
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            All Registered Users
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#ffffff', marginTop: '0.15rem' }}>
            {stats.total}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(56, 189, 248, 0.08)',
            border: '1px solid rgba(56, 189, 248, 0.28)',
          }}
        >
          <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            No Stream Key
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#38bdf8', marginTop: '0.15rem' }}>
            {stats.withoutKey}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(243, 179, 64, 0.08)',
            border: '1px solid rgba(243, 179, 64, 0.28)',
          }}
        >
          <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#fcd34d', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            With Stream Key
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#f3b340', marginTop: '0.15rem' }}>
            {stats.withKey}
          </div>
        </div>

        <div
          style={{
            padding: '0.75rem 0.9rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
        >
          <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#6ee7b7', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            TikTok Connected
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, color: '#34d399', marginTop: '0.15rem' }}>
            {stats.connected}
          </div>
        </div>
      </div>

      {/* Search, Filter & Refresh Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.6rem',
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 210px', minWidth: '170px' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search display name, @tiktok, or stream key..."
            style={{
              width: '100%',
              padding: '0.55rem 0.8rem 0.55rem 2.15rem',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.14)',
              backgroundColor: '#0b0c12',
              color: '#ffffff',
              fontSize: '0.82rem',
              outline: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          {(
            [
              { id: 'all', label: `All Users (${stats.total})` },
              { id: 'no_key', label: `No Stream Key (${stats.withoutKey})` },
              { id: 'has_key', label: `Has Stream Key (${stats.withKey})` },
              { id: 'connected', label: `TikTok Linked (${stats.connected})` },
              { id: 'not_connected', label: `No TikTok (${stats.notConnected})` },
            ] as const
          ).map((item) => {
            const active = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                style={{
                  padding: '0.42rem 0.65rem',
                  borderRadius: '8px',
                  border: active
                    ? '1px solid rgba(243, 179, 64, 0.55)'
                    : '1px solid rgba(255,255,255,0.12)',
                  backgroundColor: active
                    ? 'rgba(243, 179, 64, 0.16)'
                    : 'rgba(255,255,255,0.03)',
                  color: active ? '#f3b340' : '#cbd5e1',
                  fontSize: '0.73rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {item.label}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading}
            title="Refresh all registered users"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
              padding: '0.42rem 0.68rem',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.14)',
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: '#e2e8f0',
              fontSize: '0.73rem',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Users Directory List */}
      <div
        style={{
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          backgroundColor: '#0b0c12',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.6rem 0.95rem',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            backgroundColor: 'rgba(255,255,255,0.03)',
            fontSize: '0.68rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#94a3b8',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <span>Registered User &amp; Account Type</span>
          <span>TikTok &amp; Stream Key Status</span>
        </div>

        {filteredUsers.length === 0 ? (
          <div
            style={{
              padding: '2.1rem 1rem',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '0.84rem',
            }}
          >
            {combinedUsers.length === 0
              ? 'No registered website users recorded yet. Users appear here automatically when they sign up, sign in, or link a TikTok account.'
              : 'No registered users match your current search or filter.'}
          </div>
        ) : (
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {filteredUsers.map((user, idx) => {
              const initial = (user.displayName || 'P').charAt(0).toUpperCase();
              return (
                <div
                  key={user.uid}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.8rem 0.95rem',
                    borderBottom:
                      idx < filteredUsers.length - 1
                        ? '1px solid rgba(255,255,255,0.06)'
                        : 'none',
                  }}
                >
                  {/* Display Name + Provider + Joined */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: '180px', flex: '1 1 200px' }}>
                    <div
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '9px',
                        backgroundColor: user.tiktokConnected
                          ? 'rgba(16, 185, 129, 0.16)'
                          : 'rgba(56, 189, 248, 0.14)',
                        border: user.tiktokConnected
                          ? '1px solid rgba(16, 185, 129, 0.4)'
                          : '1px solid rgba(56, 189, 248, 0.35)',
                        color: user.tiktokConnected ? '#34d399' : '#38bdf8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '0.84rem',
                        flexShrink: 0,
                      }}
                    >
                      {initial}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: '0.88rem',
                          fontWeight: 700,
                          color: '#ffffff',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {user.displayName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                        {providerLabel(user.authProvider)} · Joined {formatRelativeDate(user.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Badges: TikTok Connection Status + Stream Key Status */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      flexWrap: 'wrap',
                      justifyContent: 'flex-end',
                    }}
                  >
                    {user.tiktokConnected ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.24rem 0.58rem',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(16, 185, 129, 0.15)',
                          border: '1px solid rgba(16, 185, 129, 0.38)',
                          color: '#34d399',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                        }}
                      >
                        <CheckCircle2 size={12} />
                        {user.linkedTikTokHandle || 'Connected'}
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.24rem 0.58rem',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(148, 163, 184, 0.1)',
                          border: '1px solid rgba(148, 163, 184, 0.25)',
                          color: '#94a3b8',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                        }}
                      >
                        <XCircle size={12} />
                        No TikTok Linked
                      </span>
                    )}

                    {user.streamKey ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.24rem 0.58rem',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(243, 179, 64, 0.15)',
                          border: '1px solid rgba(243, 179, 64, 0.42)',
                          color: '#f3b340',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        }}
                      >
                        <KeyRound size={11} />
                        {user.streamKey}
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.24rem 0.58rem',
                          borderRadius: '999px',
                          backgroundColor: 'rgba(56, 189, 248, 0.11)',
                          border: '1px solid rgba(56, 189, 248, 0.3)',
                          color: '#7dd3fc',
                          fontSize: '0.71rem',
                          fontWeight: 700,
                        }}
                      >
                        Website Member · No Stream Key
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPanelModal({ open, isOpen, onClose }: AdminPanelModalProps) {
  const isModalOpen = Boolean(open ?? isOpen);
  const { authenticatedAdmin } = useInteractiveAuthStore();

  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'mysql'>('users');

  useEffect(() => {
    if (isModalOpen) {
      setLoginUsername('');
      setLoginPassword('');
      setShowLoginPassword(false);
      setLoginError(null);
    }
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const res = verifyInteractiveAdminLogin(loginUsername, loginPassword);
    if (!res.ok) {
      setLoginError(res.error);
      return;
    }
    setLoginUsername('');
    setLoginPassword('');
  };

  const handleLockPanel = () => {
    logoutInteractiveAdmin();
    setLoginUsername('');
    setLoginPassword('');
    setLoginError(null);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(10, 8, 6, 0.78)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Site Admin Panel"
        style={{
          width: '100%',
          maxWidth: authenticatedAdmin ? '780px' : '440px',
          maxHeight: '90vh',
          backgroundColor: '#12131a',
          color: '#f5f2eb',
          border: '1px solid rgba(217, 155, 38, 0.35)',
          borderRadius: '18px',
          boxShadow: '0 28px 70px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.1rem 1.4rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(135deg, rgba(217, 155, 38, 0.14), rgba(18, 19, 26, 0.95))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(217, 155, 38, 0.16)',
                border: '1px solid rgba(217, 155, 38, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f3b340',
              }}
            >
              {authenticatedAdmin ? <Users size={20} /> : <Lock size={20} />}
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: '#f3b340',
                }}
              >
                The Missing Piece · Site Admin
              </div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.15rem',
                  fontWeight: 800,
                  color: '#ffffff',
                }}
              >
                {authenticatedAdmin
                  ? 'Registered Users Admin Panel'
                  : 'Admin Panel Sign In'}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {authenticatedAdmin && (
              <button
                type="button"
                onClick={handleLockPanel}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.45rem 0.75rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.16)',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  color: '#cbd5e1',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <LogOut size={13} />
                Lock
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Admin Panel"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.14)',
                backgroundColor: 'rgba(255,255,255,0.05)',
                color: '#cbd5e1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        {!authenticatedAdmin ? (
          <form
            onSubmit={handleLoginSubmit}
            autoComplete="off"
            style={{
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '0.86rem',
                lineHeight: 1.5,
                color: '#94a3b8',
              }}
            >
              Sign in with the same site administrator username and password used for Admin Keys
              to view registered website users, their display names, and TikTok connection status.
            </p>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#cbd5e1',
                  marginBottom: '0.4rem',
                }}
              >
                Admin Username
              </label>
              <input
                type="text"
                value={loginUsername}
                onChange={(e) => {
                  setLoginUsername(e.target.value);
                  setLoginError(null);
                }}
                placeholder="Enter admin username"
                autoComplete="off"
                autoFocus
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.16)',
                  backgroundColor: '#0b0c12',
                  color: '#ffffff',
                  fontSize: '0.92rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: '#cbd5e1',
                  marginBottom: '0.4rem',
                }}
              >
                Admin Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setLoginError(null);
                  }}
                  placeholder="Enter admin password"
                  autoComplete="new-password"
                  style={{
                    width: '100%',
                    padding: '0.7rem 2.6rem 0.7rem 0.9rem',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.16)',
                    backgroundColor: '#0b0c12',
                    color: '#ffffff',
                    fontSize: '0.92rem',
                    outline: 'none',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword((v) => !v)}
                  aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '0.6rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '0.25rem',
                  }}
                >
                  {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {loginError && (
              <div
                style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.14)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                {loginError}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.6rem',
                marginTop: '0.4rem',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: 'transparent',
                  color: '#cbd5e1',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{
                  padding: '0.65rem 1.25rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #f3b340, #d99b26)',
                  color: '#111218',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Unlock Admin Panel
              </button>
            </div>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.7rem 1.4rem',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                backgroundColor: '#0e1017',
                gap: '0.6rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('users')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.42rem 0.78rem',
                    borderRadius: '8px',
                    border:
                      activeAdminTab === 'users'
                        ? '1px solid rgba(243, 179, 64, 0.55)'
                        : '1px solid rgba(255,255,255,0.12)',
                    backgroundColor:
                      activeAdminTab === 'users'
                        ? 'rgba(243, 179, 64, 0.16)'
                        : 'rgba(255,255,255,0.03)',
                    color: activeAdminTab === 'users' ? '#f3b340' : '#cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <ShieldCheck size={14} />
                  Registered Users
                </button>
                <button
                  type="button"
                  onClick={() => setActiveAdminTab('mysql')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.42rem 0.78rem',
                    borderRadius: '8px',
                    border:
                      activeAdminTab === 'mysql'
                        ? '1px solid rgba(52, 211, 153, 0.55)'
                        : '1px solid rgba(255,255,255,0.12)',
                    backgroundColor:
                      activeAdminTab === 'mysql'
                        ? 'rgba(16, 185, 129, 0.16)'
                        : 'rgba(255,255,255,0.03)',
                    color: activeAdminTab === 'mysql' ? '#6ee7b7' : '#cbd5e1',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  <Database size={14} />
                  Hostinger MySQL &amp; SQL Export
                </button>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Signed in as{' '}
                <strong style={{ color: '#f3b340' }}>{authenticatedAdmin.username}</strong>
              </div>
            </div>

            <div style={{ padding: '1.25rem 1.4rem', overflowY: 'auto' }}>
              {activeAdminTab === 'users' ? (
                <RegisteredUsersDirectoryView enabled={isModalOpen && Boolean(authenticatedAdmin)} />
              ) : (
                <AdminMysqlMigrationPanel enabled={isModalOpen && Boolean(authenticatedAdmin)} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
