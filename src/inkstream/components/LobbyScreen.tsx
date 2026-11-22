import React, { useEffect, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowLeft,
  ArrowRight,
  EyeOff,
  Image as ImageIcon,
  Lock,
  LogOut,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { AvatarConfig, PublicRoomSummary, PublicUser } from '../shared/types.ts';
import { Avatar, AvatarCustomizer } from './Avatar.tsx';
import { LiveOverlayButton } from '@/components/interactive-games/live-overlay-button';

interface LobbyScreenProps {
  user: PublicUser | null;
  pendingInviteRoomId: string | null;
  publicRooms: PublicRoomSummary[];
  loadingRooms: boolean;
  savedArtworksCount: number;
  authError: string | null;
  roomError: string | null;
  onRegister: (payload: {
    email: string;
    username: string;
    password: string;
    avatar: AvatarConfig;
    isStreamer: boolean;
    tiktokHandle: string;
  }) => Promise<void>;
  onLogin: (payload: {
    email: string;
    password: string;
    avatar: AvatarConfig;
    isStreamer: boolean;
    tiktokHandle: string;
  }) => Promise<void>;
  onGuestLogin: (payload: {
    username: string;
    avatar: AvatarConfig;
    isStreamer: boolean;
    tiktokHandle: string;
  }) => Promise<void>;
  onUpdateAvatar: (avatar: AvatarConfig) => Promise<void>;
  onUpdateStreamerProfile: (isStreamer: boolean, tiktokHandle: string) => Promise<void>;
  onLogout: () => Promise<void>;
  onQuickPlay: () => void;
  onCreatePrivateRoom: (config: {
    name: string;
    rounds: number;
    drawTime: number;
    maxPlayers: number;
    streamerMode: boolean;
  }) => void;
  onJoinRoom: (roomId: string) => void;
  onRefreshPublicRooms: () => void;
  onOpenGallery: () => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  user,
  pendingInviteRoomId,
  publicRooms,
  loadingRooms,
  savedArtworksCount,
  authError,
  roomError,
  onRegister,
  onLogin,
  onGuestLogin,
  onUpdateAvatar,
  onUpdateStreamerProfile,
  onLogout,
  onQuickPlay,
  onCreatePrivateRoom,
  onJoinRoom,
  onRefreshPublicRooms,
  onOpenGallery,
}) => {
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'guest'>('login');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isStreamer, setIsStreamer] = useState(false);
  const [tiktokHandle, setTiktokHandle] = useState('');
  const [avatar, setAvatar] = useState<AvatarConfig>(
    user?.avatar ?? { color: '#2563EB', eyes: 0, mouth: 0, accessory: 2 }
  );
  const [submittingAuth, setSubmittingAuth] = useState(false);
  const [savingStreamerProfile, setSavingStreamerProfile] = useState(false);

  const [joinCode, setJoinCode] = useState(pendingInviteRoomId ?? '');
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomRounds, setNewRoomRounds] = useState(3);
  const [newRoomDrawTime, setNewRoomDrawTime] = useState(80);
  const [newRoomMaxPlayers, setNewRoomMaxPlayers] = useState(20);
  const [newRoomStreamerMode, setNewRoomStreamerMode] = useState(Boolean(user?.isStreamer));

  useEffect(() => {
    if (user) {
      setAvatar(user.avatar);
      setIsStreamer(Boolean(user.isStreamer));
      setTiktokHandle(user.tiktokHandle ?? '');
      setNewRoomStreamerMode(Boolean(user.isStreamer));
    }
  }, [user?.id, user?.avatar, user?.isStreamer, user?.tiktokHandle]);

  useEffect(() => {
    if (pendingInviteRoomId) {
      setJoinCode(pendingInviteRoomId);
    }
  }, [pendingInviteRoomId]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingAuth(true);
    try {
      const cleanHandle = tiktokHandle.trim().replace(/^@+/, '');
      if (authTab === 'register') {
        await onRegister({
          email,
          username,
          password,
          avatar,
          isStreamer,
          tiktokHandle: isStreamer ? cleanHandle : '',
        });
      } else if (authTab === 'login') {
        await onLogin({
          email,
          password,
          avatar,
          isStreamer,
          tiktokHandle: isStreamer ? cleanHandle : '',
        });
      } else {
        await onGuestLogin({
          username,
          avatar,
          isStreamer,
          tiktokHandle: isStreamer ? cleanHandle : '',
        });
      }
    } finally {
      setSubmittingAuth(false);
    }
  };

  const handleAvatarChange = (next: AvatarConfig) => {
    setAvatar(next);
    if (user) {
      void onUpdateAvatar(next);
    }
  };

  const handleStreamerProfileSave = async (nextIsStreamer: boolean, nextHandle: string) => {
    setIsStreamer(nextIsStreamer);
    setTiktokHandle(nextHandle);
    setNewRoomStreamerMode(nextIsStreamer);
    if (!user) return;
    setSavingStreamerProfile(true);
    try {
      await onUpdateStreamerProfile(nextIsStreamer, nextHandle.trim().replace(/^@+/, ''));
    } finally {
      setSavingStreamerProfile(false);
    }
  };

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim().toUpperCase());
  };

  const handleCreatePrivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fallbackName = user ? `${user.username}'s Room` : 'InkStream Room';
    onCreatePrivateRoom({
      name: newRoomName.trim() || fallbackName,
      rounds: newRoomRounds,
      drawTime: newRoomDrawTime,
      maxPlayers: newRoomMaxPlayers,
      streamerMode: newRoomStreamerMode,
    });
  };

  return (
    <div className="min-h-screen studio-desk-bg flex flex-col">
      {/* Clean 3-Zone Top Bar */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/interactive-games"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Interactive Hub</span>
            </Link>
            <div className="flex items-center gap-2.5">
              <img
                src="/assets/aistudio/3d_logo_944e5372.png"
                alt="The Missing Piece"
                className="w-8 h-8 rounded-full object-contain shrink-0"
              />
              <div className="leading-tight">
                <span className="font-display font-extrabold text-xl tracking-tight text-[#F6C915] block whitespace-nowrap">
                  InkStream
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 block">
                  The Missing Piece
                </span>
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a
              href="#play-hub"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Play Now
            </a>
            <a
              href="#private-room"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Host &amp; Stream
            </a>
            <a
              href="#public-rooms"
              className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
            >
              Public Lobbies
            </a>
            {user && (
              <button
                type="button"
                onClick={onOpenGallery}
                className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Artwork Gallery ({savedArtworksCount})
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <LiveOverlayButton
              gameTitle="InkStream"
              gameSlug="inkstream"
              streamerHandle={user?.tiktokHandle}
              recommendedSize="640 × 720 or 1080 × 1920"
              label="LIVE Overlay"
            />
            {user ? (
              <button
                type="button"
                onClick={() => void onLogout()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Switch Profile
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthTab('register')}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Create Account
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        {/* Hero Intro */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 [text-wrap:balance]">
              Draw live. Guess with your chat.
            </h1>
            <p className="text-base text-slate-600 mt-2">
              Real-time multiplayer drawing and guessing for up to 20 players, with TikTok LIVE
              chat guessing, a dedicated TikTok scoreboard, hidden streamer word popups, and
              artwork downloads.
            </p>
          </div>
          {pendingInviteRoomId && (
            <div className="px-4 py-2.5 rounded-xl bg-blue-50 border border-blue-200 text-sm text-blue-900 font-medium shrink-0">
              Invited to room{' '}
              <span className="font-mono-tabular font-bold">{pendingInviteRoomId}</span>
            </div>
          )}
        </section>

        {/* 2-Column Workspace Split */}
        <div id="play-hub" className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column (5 cols): Account / Login + Avatar Studio */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-5">
            {user ? (
              <>
                {/* Signed-in User Header */}
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar config={user.avatar} size={52} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="font-display font-bold text-xl text-slate-900 truncate">
                          {user.username}
                        </h2>
                        {user.isStreamer && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 shrink-0">
                            <Radio className="w-3 h-3" />
                            Streamer
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">
                        {user.isGuest ? 'Guest session' : user.email}
                        {user.tiktokHandle ? ` · @${user.tiktokHandle}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenGallery}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shrink-0"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                    Gallery
                  </button>
                </div>

                {/* Career Stats Row */}
                <div className="grid grid-cols-4 gap-2 text-center py-2 border-b border-slate-100">
                  <div>
                    <p className="font-mono-tabular text-lg font-bold text-slate-900">
                      {user.stats.gamesPlayed}
                    </p>
                    <p className="text-[11px] text-slate-500">Games</p>
                  </div>
                  <div>
                    <p className="font-mono-tabular text-lg font-bold text-slate-900">
                      {user.stats.gamesWon}
                    </p>
                    <p className="text-[11px] text-slate-500">Wins</p>
                  </div>
                  <div>
                    <p className="font-mono-tabular text-lg font-bold text-slate-900">
                      {user.stats.wordsGuessed}
                    </p>
                    <p className="text-[11px] text-slate-500">Guessed</p>
                  </div>
                  <div>
                    <p className="font-mono-tabular text-lg font-bold text-slate-900">
                      {user.stats.bestScore}
                    </p>
                    <p className="text-[11px] text-slate-500">Best</p>
                  </div>
                </div>

                {/* Streamer Profile Controls */}
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isStreamer}
                      onChange={(e) =>
                        void handleStreamerProfileSave(e.target.checked, tiktokHandle)
                      }
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <span className="text-xs text-slate-700 leading-snug">
                      <strong className="text-slate-900">Streamer Account</strong> — Enable hidden
                      word popups and TikTok LIVE room hosting by default.
                    </span>
                  </label>

                  {isStreamer && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tiktokHandle}
                        onChange={(e) => setTiktokHandle(e.target.value)}
                        placeholder="@your_tiktok_handle"
                        maxLength={33}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                      <button
                        type="button"
                        disabled={savingStreamerProfile}
                        onClick={() => void handleStreamerProfileSave(true, tiktokHandle)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {savingStreamerProfile ? 'Saving...' : 'Save Handle'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar Customizer */}
                <div>
                  <h3 className="text-xs font-semibold text-slate-700 mb-3">
                    Customize Your Avatar
                  </h3>
                  <AvatarCustomizer value={avatar} onChange={handleAvatarChange} />
                </div>
              </>
            ) : (
              <>
                <div>
                  <h2 className="font-display font-bold text-xl text-slate-900">
                    Sign In to Play
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Create an account, sign in as a player or streamer, or join as a guest.
                  </p>
                </div>

                {/* Segmented Auth Mode Control */}
                <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setAuthTab('login')}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      authTab === 'login'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab('register')}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      authTab === 'register'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthTab('guest')}
                    className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      authTab === 'guest'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Guest
                  </button>
                </div>

                <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3.5">
                  {authTab !== 'guest' && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700" htmlFor="auth-email">
                        Email Address
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>
                  )}

                  {(authTab === 'register' || authTab === 'guest') && (
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-slate-700" htmlFor="auth-name">
                        {authTab === 'guest' ? 'Nickname' : 'Display Name'}
                      </label>
                      <input
                        id="auth-name"
                        type="text"
                        required={authTab === 'register'}
                        minLength={2}
                        maxLength={20}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder={authTab === 'guest' ? 'SketchMaster' : 'Choose a display name'}
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>
                  )}

                  {authTab !== 'guest' && (
                    <div className="flex flex-col gap-1">
                      <label
                        className="text-xs font-semibold text-slate-700"
                        htmlFor="auth-password"
                      >
                        Password
                      </label>
                      <input
                        id="auth-password"
                        type="password"
                        required
                        minLength={6}
                        autoComplete={authTab === 'register' ? 'new-password' : 'current-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                      />
                    </div>
                  )}

                  {/* Streamer Login Toggle + TikTok Username */}
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col gap-2.5">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isStreamer}
                        onChange={(e) => setIsStreamer(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                      />
                      <span className="text-xs text-slate-700 leading-snug">
                        <strong className="text-slate-900">Sign in as a Streamer</strong> — Host
                        rooms with private word popups &amp; TikTok LIVE chat.
                      </span>
                    </label>

                    {isStreamer && (
                      <div className="flex flex-col gap-1">
                        <label
                          className="text-[11px] font-semibold text-slate-600"
                          htmlFor="auth-tiktok"
                        >
                          TikTok LIVE Username (optional)
                        </label>
                        <input
                          id="auth-tiktok"
                          type="text"
                          value={tiktokHandle}
                          onChange={(e) => setTiktokHandle(e.target.value)}
                          placeholder="@your_tiktok_handle"
                          maxLength={33}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-700 mb-2.5">Your Avatar</p>
                    <AvatarCustomizer value={avatar} onChange={setAvatar} />
                  </div>

                  {authError && (
                    <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingAuth}
                    className="mt-1 w-full py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {submittingAuth
                      ? 'Connecting...'
                      : authTab === 'register'
                        ? isStreamer
                          ? 'Create Streamer Account'
                          : 'Create Account & Enter'
                        : authTab === 'login'
                          ? isStreamer
                            ? 'Sign In as Streamer'
                            : 'Sign In'
                          : isStreamer
                            ? 'Continue as Streamer'
                            : 'Continue as Guest'}
                  </button>
                </form>
              </>
            )}
          </section>

          {/* Right Column (7 cols): Quick Play, Private/Streamer Rooms, Public Rooms */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            {roomError && (
              <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-sm font-medium text-rose-700">
                {roomError}
              </div>
            )}

            {/* Quick Play + Join by Code */}
            <section className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-bold text-xl text-slate-900">
                    Jump into a Match
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Join an active public table immediately or enter a friend&apos;s room code.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!user}
                  onClick={onQuickPlay}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Play className="w-4 h-4" />
                  Quick Play
                </button>
              </div>

              <form
                onSubmit={handleJoinSubmit}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-4 border-t border-slate-100"
              >
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  placeholder="Enter 6-letter room code (e.g. K7M2PX)"
                  className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-mono-tabular text-sm uppercase tracking-wider text-slate-900 placeholder:normal-case placeholder:tracking-normal placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                />
                <button
                  type="submit"
                  disabled={!user || !joinCode.trim()}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                >
                  Join Room
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </section>

            {/* Create Custom Private / Streamer Room */}
            <section
              id="private-room"
              className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-4"
            >
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-blue-600" />
                <h2 className="font-display font-bold text-lg text-slate-900">
                  Create Custom Private / Streamer Room
                </h2>
              </div>
              <p className="text-xs text-slate-500 -mt-2">
                Host up to 20 players with custom words, TikTok LIVE chat integration, hidden
                streamer word popups, and full Lobby Owner Analytics.
              </p>

              <form
                onSubmit={handleCreatePrivateSubmit}
                className="grid grid-cols-1 sm:grid-cols-12 gap-3"
              >
                <div className="sm:col-span-5 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Room Name</label>
                  <input
                    type="text"
                    maxLength={40}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Friday Stream Night"
                    className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
                  />
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Players</label>
                  <select
                    value={newRoomMaxPlayers}
                    onChange={(e) => setNewRoomMaxPlayers(Number(e.target.value))}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 font-mono-tabular"
                  >
                    {[4, 8, 12, 16, 20].map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Rounds</label>
                  <select
                    value={newRoomRounds}
                    onChange={(e) => setNewRoomRounds(Number(e.target.value))}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 font-mono-tabular"
                  >
                    {[2, 3, 4, 5, 6, 8].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3 flex flex-col gap-1">
                  <label className="text-xs font-semibold text-slate-700">Draw Time</label>
                  <select
                    value={newRoomDrawTime}
                    onChange={(e) => setNewRoomDrawTime(Number(e.target.value))}
                    className="px-2.5 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 font-mono-tabular"
                  >
                    {[45, 60, 80, 100, 120].map((t) => (
                      <option key={t} value={t}>
                        {t}s
                      </option>
                    ))}
                  </select>
                </div>

                {/* Streamer Mode Checkbox */}
                <div className="sm:col-span-12">
                  <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newRoomStreamerMode}
                      onChange={(e) => setNewRoomStreamerMode(e.target.checked)}
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                        <EyeOff className="w-3.5 h-3.5 text-blue-600" />
                        Enable Streamer Mode (Private Word Popup)
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        When it is your turn to draw, your 3 word choices and secret word stay
                        hidden on the main broadcast screen and appear in a separate private popup
                        window.
                      </p>
                    </div>
                  </label>
                </div>

                <div className="sm:col-span-12 flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-slate-500">
                    {!user
                      ? 'Sign in or continue as guest on the left to host a room.'
                      : 'Connect TikTok LIVE and open your private word popup inside the room.'}
                  </span>
                  <button
                    type="submit"
                    disabled={!user}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    {newRoomStreamerMode ? 'Host Streamer Room' : 'Create Private Room'}
                  </button>
                </div>
              </form>
            </section>

            {/* Active Public Lobbies */}
            <section
              id="public-rooms"
              className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="font-display font-bold text-lg text-slate-900">
                    Public Lobbies
                  </h2>
                  <p className="text-xs text-slate-500">
                    Open multiplayer tables currently accepting up to 20 players
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onRefreshPublicRooms}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {publicRooms.length === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-slate-500">
                  No open public rooms yet — click{' '}
                  <strong className="text-slate-800">Quick Play</strong> to open one.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {publicRooms.map((r) => (
                    <div
                      key={r.id}
                      className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 truncate">{r.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Host: {r.ownerName} · Code{' '}
                          <span className="font-mono-tabular font-semibold text-slate-700">
                            {r.id}
                          </span>{' '}
                          ·{' '}
                          {r.phase === 'LOBBY'
                            ? 'In Lobby'
                            : `Round ${r.currentRound}/${r.totalRounds}`}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        <span className="inline-flex items-center gap-1 text-xs font-mono-tabular font-semibold text-slate-700">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {r.playerCount}/{r.maxPlayers}
                        </span>
                        <button
                          type="button"
                          disabled={!user || r.playerCount >= r.maxPlayers}
                          onClick={() => onJoinRoom(r.id)}
                          className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-45 transition-colors cursor-pointer"
                        >
                          Join
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};
