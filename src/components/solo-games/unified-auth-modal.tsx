import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  KeyRound,
  Lock,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Sparkles,
  Trophy,
  User as UserIcon,
  X,
} from 'lucide-react';
import {
  INTERACTIVE_GAME_LABELS,
  MAX_DISPLAY_NAME_LENGTH,
  SOLO_GAME_LABELS,
  checkResetLinkParams,
  completePasswordResetWithLink,
  getCleanDisplayName,
  getCleanUserEmail,
  loginWithEmailPassword,
  logoutUser,
  normalizeTikTokHandle,
  registerWithEmailPassword,
  resetAccountPassword,
  setLinkedTikTokHandle,
  signInWithGoogleEmailFallback,
  signInWithGooglePopup,
  subscribeToAllLeaderboards,
  useInteractiveProfileScores,
  useUnifiedAuth,
  type InteractiveGameId,
  type SoloGameId,
  type UnifiedLeaderboardEntry,
  type UnifiedPlayerUser,
  type User,
} from '@/lib/unified-game-auth';

const SOLO_GAME_META: Record<
  SoloGameId,
  { number: string; title: string; shortTitle: string; subtitle: string }
> = {
  crossword: {
    number: '01',
    title: 'Cruciverbalist Daily Crossword',
    shortTitle: 'Crossword',
    subtitle: '20×20 & 8×8 Daily Crossword Ratings',
  },
  cruciverbalist: {
    number: '01',
    title: 'Cruciverbalist Daily Crossword',
    shortTitle: 'Crossword',
    subtitle: '20×20 & 8×8 Daily Crossword Ratings',
  },
  rebus: {
    number: '02',
    title: 'Missing Rebus',
    shortTitle: 'Missing Rebus',
    subtitle: '733+ Rebus Archive & Sprint Scores',
  },
  squared: {
    number: '03',
    title: 'Squared — Daily Word Grid',
    shortTitle: 'Squared',
    subtitle: '3×3, 4×4 & 5×5 Word Grid High Scores',
  },
  thematix: {
    number: '04',
    title: 'Thematix — Word Association',
    shortTitle: 'Thematix',
    subtitle: 'Daily Word Association & Hard Mode Scores',
  },
  destack: {
    number: '05',
    title: 'DeStack — Word Unstacking',
    shortTitle: 'DeStack',
    subtitle: 'Daily 4-Layer & 6-Layer Word Stack Scores',
  },
};

const ALLOWED_GAMES: SoloGameId[] = ['crossword', 'rebus', 'squared', 'thematix', 'destack'];

export function UnifiedLeaderboardPanel({
  initialGameId = 'crossword',
  currentUser,
  onRequestSignIn,
  compact = false,
}: {
  initialGameId?: SoloGameId;
  currentUser?: UnifiedPlayerUser | User | { uid: string } | null;
  onRequestSignIn?: () => void;
  compact?: boolean;
}) {
  const [selectedGame, setSelectedGame] = useState<SoloGameId>(
    initialGameId === 'cruciverbalist' ? 'crossword' : initialGameId
  );
  const [leaderboards, setLeaderboards] = useState<
    Record<SoloGameId, UnifiedLeaderboardEntry[]>
  >({
    rebus: [],
    squared: [],
    thematix: [],
    destack: [],
    cruciverbalist: [],
    crossword: [],
  });

  useEffect(() => {
    setSelectedGame(initialGameId === 'cruciverbalist' ? 'crossword' : initialGameId);
  }, [initialGameId]);

  useEffect(() => {
    const unsub = subscribeToAllLeaderboards((grouped) => {
      setLeaderboards(grouped);
    });
    return () => unsub();
  }, []);

  const meta = SOLO_GAME_META[selectedGame] || SOLO_GAME_META.crossword;
  const currentEntries = leaderboards[selectedGame] || [];

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#F6C915]/15 border border-[#F6C915]/40 flex items-center justify-center text-[#F6C915] shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#F6C915] font-bold">
                PUBLIC VISITOR LEADERBOARDS
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-[10px] font-mono text-emerald-300">
                ● LIVE
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              {meta.number} / {meta.title}
            </h3>
          </div>
        </div>

        {!currentUser && onRequestSignIn && (
          <button
            type="button"
            onClick={onRequestSignIn}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-bold text-xs transition-all cursor-pointer shrink-0 shadow-sm"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In to Post Scores</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1.5 rounded-xl bg-black/35 border border-white/10">
        {ALLOWED_GAMES.map((gId) => {
          const gMeta = SOLO_GAME_META[gId];
          const count = leaderboards[gId]?.length || 0;
          const isActive = selectedGame === gId;
          return (
            <button
              key={gId}
              type="button"
              onClick={() => setSelectedGame(gId)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#F6C915] text-[#1D0830] shadow-xs'
                  : 'text-[#D6CBE2] hover:text-white hover:bg-white/5'
              }`}
            >
              <span className="truncate">
                {gMeta.number}. {gMeta.shortTitle}
              </span>
              <span
                className={`ml-1.5 px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isActive ? 'bg-[#1D0830]/15 text-[#1D0830]' : 'bg-white/10 text-[#B9A8CC]'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-[#B9A8CC] px-1">
          <span>{meta.subtitle}</span>
          <span className="font-mono text-[11px]">Sorted by Highest Score</span>
        </div>

        {currentEntries.length === 0 ? (
          <div className="p-6 rounded-xl bg-black/25 border border-white/10 text-center space-y-2">
            <Sparkles className="w-6 h-6 text-[#F6C915] mx-auto opacity-80" />
            <p className="text-sm font-bold text-white">
              No scores recorded on the {meta.shortTitle} board yet!
            </p>
            <p className="text-xs text-[#B9A8CC] max-w-md mx-auto">
              Sign in with Google or Email &amp; Password and play {meta.shortTitle} to claim the #1
              spot on the public leaderboard.
            </p>
          </div>
        ) : (
          <div
            className={`space-y-1.5 overflow-y-auto pr-1 custom-scrollbar ${
              compact ? 'max-h-64' : 'max-h-80'
            }`}
          >
            {currentEntries.slice(0, 50).map((entry, idx) => {
              const isMe = Boolean(currentUser && entry.uid === currentUser.uid);
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-xs transition-colors ${
                    isMe
                      ? 'bg-[#351058] border-[#F6C915]/70 shadow-xs'
                      : 'bg-white/6 hover:bg-white/10 border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold shrink-0 bg-black/35 border border-white/10 text-[#F6C915]">
                      {idx === 0 ? <Crown className="w-4 h-4 text-[#F6C915]" /> : `#${idx + 1}`}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-white truncate flex items-center gap-1.5">
                        <span>{entry.displayName}</span>
                        {isMe && (
                          <span className="px-1.5 py-0.5 rounded bg-[#F6C915]/20 text-[#F6C915] text-[10px] font-mono">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-[#B9A8CC] truncate">
                        {entry.metricLabel || SOLO_GAME_LABELS[selectedGame]?.metric}
                      </div>
                    </div>
                  </div>

                  <div className="font-mono font-extrabold text-sm text-[#F6C915] tabular-nums shrink-0">
                    {entry.score.toLocaleString()} pts
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

interface UnifiedAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialGameTab?: SoloGameId;
  initialGameId?: SoloGameId;
  initialTab?: 'account' | 'leaderboards';
  user?: UnifiedPlayerUser | User | null;
}

export function UnifiedAuthModal({
  isOpen,
  onClose,
  initialGameTab,
  initialGameId = 'crossword',
  initialTab = 'account',
}: UnifiedAuthModalProps) {
  const { user } = useUnifiedAuth();
  const interactiveScores = useInteractiveProfileScores(user?.uid);

  const resolvedGameId: SoloGameId = initialGameTab || initialGameId || 'crossword';
  const [modalTab, setModalTab] = useState<'account' | 'leaderboards'>(initialTab);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'reset' | 'complete-reset'>(
    'login'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [registerTikTok, setRegisterTikTok] = useState('');
  const [profileTikTokInput, setProfileTikTokInput] = useState('');
  const [showGoogleEmailSheet, setShowGoogleEmailSheet] = useState(false);
  const [googleEmailInput, setGoogleEmailInput] = useState('');
  const [googleNameInput, setGoogleNameInput] = useState('');
  const [resetOobCode, setResetOobCode] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setModalTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    setProfileTikTokInput(user?.linkedTikTokHandle || '');
  }, [user?.linkedTikTokHandle, user?.uid]);

  useEffect(() => {
    if (!isOpen) return;
    setShowGoogleEmailSheet(false);
    setErrorMsg(null);
    setSuccessMsg(null);
    checkResetLinkParams().then((info) => {
      if (info.hasResetLink) {
        setModalTab('account');
        if (info.error) {
          setAuthMode('reset');
          setErrorMsg(info.error);
        } else {
          setAuthMode('complete-reset');
          setResetOobCode(info.oobCode);
          setResetToken(info.resetToken);
          if (info.email) setEmail(info.email);
        }
      }
    });
  }, [isOpen]);

  if (!isOpen) return null;

  const cleanEmail = getCleanUserEmail(user);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await signInWithGooglePopup(email);
      setShowGoogleEmailSheet(false);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/inline-google-prompt' ||
        code === 'auth/unauthorized-domain' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        setGoogleEmailInput(email);
        setGoogleNameInput(displayName);
        setShowGoogleEmailSheet(true);
      } else if (code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed before completing.');
      } else {
        setGoogleEmailInput(email);
        setGoogleNameInput(displayName);
        setShowGoogleEmailSheet(true);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleEmailSheetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await signInWithGoogleEmailFallback(googleEmailInput, googleNameInput);
      setShowGoogleEmailSheet(false);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Please enter a valid Google email address.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (authMode === 'complete-reset') {
      if (password.length < 6) {
        setErrorMsg('Please enter a new password of at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('New password and confirmation do not match.');
        return;
      }
      setSubmitting(true);
      try {
        const result = await completePasswordResetWithLink({
          oobCode: resetOobCode,
          resetToken,
          newPassword: password,
        });
        setSuccessMsg(result.message);
        setPassword('');
        setConfirmPassword('');
        setResetOobCode(null);
        setResetToken(null);
        setAuthMode('login');
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Could not complete password reset.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Please enter your email address.');
      return;
    }

    if (authMode === 'reset') {
      setSubmitting(true);
      try {
        const result = await resetAccountPassword(email);
        setSuccessMsg(result.message);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Could not send password reset email.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Please enter a valid email and a password of at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      if (authMode === 'register') {
        await registerWithEmailPassword({
          email,
          password,
          displayName: displayName.slice(0, MAX_DISPLAY_NAME_LENGTH) || 'Puzzle Seeker',
          tiktokHandle: registerTikTok,
        });
        setSuccessMsg('Account created! You are now signed in across The Missing Piece.');
      } else {
        await loginWithEmailPassword(email, password);
        setSuccessMsg('Signed in! Your profile and scores are synced across The Missing Piece.');
      }
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setErrorMsg(
          'Invalid email or password. Please check your credentials or use Forgot Password.'
        );
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg(
          'This email is already registered. Switch to Sign In or use Forgot Password.'
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveTikTokLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const saved = setLinkedTikTokHandle(
      user.uid,
      getCleanDisplayName(user),
      profileTikTokInput
    );
    setProfileTikTokInput(saved);
    setSuccessMsg(
      saved
        ? `Linked TikTok ${saved}! Scores earned by ${saved} in Interactive Games now apply to your account.`
        : 'TikTok @ handle unlinked from your profile.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-gradient-to-b from-[#2B0948] to-[#160326] border-2 border-[#D4A437] p-4 sm:p-6 text-[#F5F3F7] shadow-[0_24px_60px_rgba(0,0,0,0.85)] space-y-5 max-h-[92vh] overflow-y-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <img
              src="/brand-logo.png"
              alt="The Missing Piece"
              className="w-9 h-9 rounded-full object-contain shrink-0"
            />
            <div>
              <h2 className="font-extrabold text-base sm:text-lg text-[#F6C915]">
                The Missing Piece · Member Account &amp; Leaderboards
              </h2>
              <p className="text-xs text-[#D6CBE2]">
                One unified login across the main site, interactive games &amp; solo puzzles
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#D6CBE2] hover:text-white cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Account vs Leaderboards Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setModalTab('account')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              modalTab === 'account'
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'text-[#D6CBE2] hover:text-white'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5" />
            <span>
              {user ? `Account (${getCleanDisplayName(user)})` : 'Sign In / Create Account'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab('leaderboards')}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              modalTab === 'leaderboards'
                ? 'bg-[#F6C915] text-[#1D0830]'
                : 'text-[#D6CBE2] hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>All Game Leaderboards</span>
          </button>
        </div>

        {modalTab === 'leaderboards' ? (
          <UnifiedLeaderboardPanel
            initialGameId={resolvedGameId}
            currentUser={user}
            onRequestSignIn={() => setModalTab('account')}
            compact
          />
        ) : user && authMode !== 'complete-reset' ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-[#1E0533] border border-[#E6BE5A]/40 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>The Missing Piece Member Account Active</span>
                  </div>
                  <div className="text-base font-extrabold text-white">
                    {getCleanDisplayName(user)}
                  </div>
                  {cleanEmail && (
                    <div className="text-xs text-[#B9A8CC] font-mono">{cleanEmail}</div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => logoutUser()}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-rose-500/25 text-xs font-semibold text-[#F5F3F7] hover:text-rose-200 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>

            {/* Link TikTok @ Handle Section */}
            <div className="p-4 rounded-xl bg-black/35 border border-[#F6C915]/35 space-y-3">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#F6C915] font-bold">
                  LINK TIKTOK @ TO YOUR WEBSITE ACCOUNT
                </div>
                <p className="text-xs text-[#D6CBE2] mt-0.5">
                  When your linked TikTok <code>@username</code> scores points in any Interactive
                  Game (WiKirecTangled, WikiContexto, Squared Interactive, Lexi Tiles, or DeStack
                  Interactive), those points are automatically credited to your website profile.
                </p>
              </div>

              <form onSubmit={handleSaveTikTokLink} className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={profileTikTokInput}
                  onChange={(e) => setProfileTikTokInput(e.target.value)}
                  placeholder="@yourtiktokhandle"
                  className="flex-1 min-w-[180px] px-3.5 py-2 rounded-xl bg-black/50 border border-white/20 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F6C915] hover:bg-[#FFE047] text-[#1D0830] font-bold text-xs cursor-pointer"
                >
                  {user.linkedTikTokHandle ? 'Update TikTok @' : 'Link TikTok @'}
                </button>
              </form>

              {successMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-950/70 border border-emerald-400/40 text-xs text-emerald-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Interactive Games Credited Scores Breakdown */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#F5F3F7]">
                    Interactive Games Score ({normalizeTikTokHandle(user.linkedTikTokHandle) || 'No @ linked yet'})
                  </span>
                  <span className="font-mono font-extrabold text-[#F6C915]">
                    {(interactiveScores?.totalPoints || 0).toLocaleString()} pts total
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(Object.keys(INTERACTIVE_GAME_LABELS) as InteractiveGameId[]).map((gId) => (
                    <div
                      key={gId}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-center"
                    >
                      <div className="text-[11px] text-[#B9A8CC] truncate">
                        {INTERACTIVE_GAME_LABELS[gId]}
                      </div>
                      <div className="font-mono font-bold text-sm text-[#F6C915] mt-0.5">
                        {(interactiveScores?.gamesPlayed?.[gId] || 0).toLocaleString()} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!showGoogleEmailSheet ? (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-white text-[#1D0830] font-extrabold text-sm shadow-md hover:bg-gray-100 transition-all cursor-pointer disabled:opacity-60"
              >
                <LogIn className="w-4 h-4 text-[#4B1276]" />
                <span>Continue with Google</span>
              </button>
            ) : (
              <form
                onSubmit={handleGoogleEmailSheetSubmit}
                className="p-4 rounded-xl bg-white/10 border-2 border-[#F6C915] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#F6C915] uppercase tracking-wider">
                    Continue with Google Account
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGoogleEmailSheet(false)}
                    className="text-xs text-[#D6CBE2] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] text-[#D6CBE2] mb-1">
                      Google Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={googleEmailInput}
                      onChange={(e) => setGoogleEmailInput(e.target.value)}
                      placeholder="you@gmail.com"
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/20 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-[#D6CBE2] mb-1">
                      Leaderboard Name (optional)
                    </label>
                    <input
                      type="text"
                      maxLength={MAX_DISPLAY_NAME_LENGTH}
                      value={googleNameInput}
                      onChange={(e) => setGoogleNameInput(e.target.value)}
                      placeholder="Puzzle Seeker"
                      className="w-full px-3 py-2 rounded-lg bg-black/50 border border-white/20 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 rounded-lg bg-white text-[#1D0830] font-extrabold text-xs shadow-sm hover:bg-gray-100 cursor-pointer"
                >
                  {submitting ? 'Signing in...' : 'Sign In with Google'}
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 text-xs text-[#9E8BB5]">
              <div className="flex-1 h-px bg-white/10" />
              <span>or use Email &amp; Password</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <div className="grid grid-cols-3 gap-1 p-1 bg-black/35 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'login'
                    ? 'bg-[#F6C915] text-[#1D0830]'
                    : 'text-[#D6CBE2] hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'register'
                    ? 'bg-[#F6C915] text-[#1D0830]'
                    : 'text-[#D6CBE2] hover:text-white'
                }`}
              >
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('reset');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className={`py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  authMode === 'reset' || authMode === 'complete-reset'
                    ? 'bg-[#F6C915] text-[#1D0830]'
                    : 'text-[#D6CBE2] hover:text-white'
                }`}
              >
                Forgot Password
              </button>
            </div>

            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-400/40 text-xs text-emerald-200 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-3">
              {authMode === 'register' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#D6CBE2] mb-1">
                      Player Display Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-[#9E8BB5] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={MAX_DISPLAY_NAME_LENGTH}
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Puzzle Seeker"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-[#D6CBE2] mb-1">
                      TikTok @ Handle (optional)
                    </label>
                    <input
                      type="text"
                      value={registerTikTok}
                      onChange={(e) => setRegisterTikTok(e.target.value)}
                      placeholder="@yourtiktokhandle"
                      className="w-full px-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                </div>
              )}

              {authMode !== 'complete-reset' && (
                <div>
                  <label className="block text-xs text-[#D6CBE2] mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-[#9E8BB5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seeker@example.com"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                </div>
              )}

              {authMode === 'reset' && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-[#D6CBE2] flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#F6C915] shrink-0 mt-0.5" />
                  <span>
                    For your account security, we will send a one-time password reset link to your
                    email address. You can set a new password only after opening that link.
                  </span>
                </div>
              )}

              {(authMode === 'login' ||
                authMode === 'register' ||
                authMode === 'complete-reset') && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-[#D6CBE2]">
                      {authMode === 'complete-reset'
                        ? 'New Password (min. 6 characters)'
                        : 'Password (min. 6 characters)'}
                    </label>
                    {authMode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('reset');
                          setErrorMsg(null);
                          setSuccessMsg(null);
                        }}
                        className="text-[11px] font-semibold text-[#F6C915] hover:underline cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-[#9E8BB5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                </div>
              )}

              {authMode === 'complete-reset' && (
                <div>
                  <label className="block text-xs text-[#D6CBE2] mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#9E8BB5] absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/40 border border-white/15 text-xs text-white placeholder-[#8A759E] focus:outline-none focus:border-[#F6C915]"
                    />
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-400/40 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl bg-gradient-to-b from-[#FFE566] to-[#E5B012] text-[#1D0830] font-extrabold text-xs tracking-wide hover:brightness-105 transition-all cursor-pointer disabled:opacity-60"
              >
                {submitting
                  ? 'Please wait...'
                  : authMode === 'register'
                    ? 'Create Account & Sync Across The Missing Piece'
                    : authMode === 'reset'
                      ? 'Send Password Reset Link'
                      : authMode === 'complete-reset'
                        ? 'Save New Password'
                        : 'Sign In with Email'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
