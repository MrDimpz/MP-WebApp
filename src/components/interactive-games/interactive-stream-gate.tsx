import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import { Moon, Sun } from "lucide-react";
import {
  clearActiveInteractiveStreamerSession,
  getActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
  useInteractiveAuthStore,
  validateInteractiveStreamerKey,
} from "../../lib/interactive-key-auth";
import {
  INTERACTIVE_CONTACT_EMAIL,
  INTERACTIVE_CONTACT_TIKTOK_HANDLE,
  INTERACTIVE_CONTACT_TIKTOK_URL,
  InteractiveGameSlug,
  MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY,
  useInteractiveDailyLimit,
} from "../../lib/interactive-daily-limits";
import {
  normalizeTikTokHandle,
  setLinkedTikTokHandle,
  useInteractiveProfileScores,
  useUnifiedAuth,
} from "../../lib/unified-game-auth";
import { useSiteTheme } from "../../lib/site-theme";
import { AdminPortalModal } from "./admin-portal-modal";
import { UnifiedAuthModal } from "../solo-games/unified-auth-modal";
import { getOverlayConfigFromLocation } from "../../lib/live-overlay";

interface InteractiveStreamGateProps {
  gameTitle: string;
  gameSlug: InteractiveGameSlug;
  children: React.ReactNode;
}

/**
 * Provides unified open access across all interactive games:
 * - Anyone without a Stream Key can play up to 3 rounds per game per day.
 * - Anyone with a valid Stream Key (`LIVE-xxxx-xxxx` registered for a `@username`)
 *   gets unlimited usage across all interactive games.
 * - Also provides direct Admin Portal access, optional Stream Key unlock modal,
 *   Back link to `/interactive-games`, and Brand Logo link to `/`.
 */
export function InteractiveStreamGate({
  gameTitle,
  gameSlug,
  children,
}: InteractiveStreamGateProps) {
  const { isOverlay } = getOverlayConfigFromLocation();
  if (isOverlay) {
    return <>{children}</>;
  }
  return (
    <InteractiveStreamGateInner gameTitle={gameTitle} gameSlug={gameSlug}>
      {children}
    </InteractiveStreamGateInner>
  );
}

function InteractiveStreamGateInner({
  gameTitle,
  gameSlug,
  children,
}: InteractiveStreamGateProps) {
  const { activeStreamer } = useInteractiveAuthStore();
  const { user: siteUser } = useUnifiedAuth();
  const { darkMode, toggleDarkMode } = useSiteTheme();
  const profileScores = useInteractiveProfileScores(siteUser?.uid);
  const dailyLimit = useInteractiveDailyLimit(gameSlug);

  const [usernameInput, setUsernameInput] = useState("");
  const [streamKeyInput, setStreamKeyInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showLimitWall, setShowLimitWall] = useState<boolean>(
    () => !dailyLimit.isUnlimited && dailyLimit.isLimitReached
  );

  // Smoothly reveal the Daily Limit screen when a free user finishes their 3rd round,
  // or immediately if they already hit the limit before opening or try to start round 4.
  useEffect(() => {
    if (dailyLimit.isUnlimited || !dailyLimit.isLimitReached) {
      setShowLimitWall(false);
      return;
    }
    if (dailyLimit.lockImmediately) {
      setShowLimitWall(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setShowLimitWall(true);
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [
    dailyLimit.isUnlimited,
    dailyLimit.isLimitReached,
    dailyLimit.lockImmediately,
  ]);

  // 15-Minute Inactivity Tracker for active Stream Key sessions
  useEffect(() => {
    if (!activeStreamer) return;

    const onUserActivity = () => {
      touchActiveInteractiveStreamerSession();
    };

    window.addEventListener("pointerdown", onUserActivity, { passive: true });
    window.addEventListener("keydown", onUserActivity, { passive: true });
    window.addEventListener("scroll", onUserActivity, { passive: true });
    window.addEventListener("mousemove", onUserActivity, { passive: true });
    window.addEventListener("touchstart", onUserActivity, { passive: true });

    const interval = setInterval(() => {
      const current = getActiveInteractiveStreamerSession();
      if (!current) {
        clearActiveInteractiveStreamerSession();
      }
    }, 10000);

    return () => {
      window.removeEventListener("pointerdown", onUserActivity);
      window.removeEventListener("keydown", onUserActivity);
      window.removeEventListener("scroll", onUserActivity);
      window.removeEventListener("mousemove", onUserActivity);
      window.removeEventListener("touchstart", onUserActivity);
      clearInterval(interval);
    };
  }, [activeStreamer]);

  // If the signed-in website user unlocks a stream key with a TikTok @username
  // and hasn't linked a TikTok @ yet, automatically link it to their profile.
  const handleUnlockStreamKey = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const result = validateInteractiveStreamerKey(
      usernameInput,
      streamKeyInput
    );
    if (!result.valid || !result.streamer) {
      setErrorMsg(
        result.error ||
          "Valid @username and LIVE-xxxx-xxxx stream key required."
      );
      return;
    }
    if (siteUser && !siteUser.linkedTikTokHandle) {
      setLinkedTikTokHandle(
        siteUser.uid,
        siteUser.displayName || "Player",
        result.streamer.username
      );
    }
    setShowKeyModal(false);
    setShowLimitWall(false);
    setUsernameInput("");
    setStreamKeyInput("");
  };

  const renderKeyCard = (isLimitReachedMode: boolean) => (
    <div
      className="relative z-20 w-full max-w-lg rounded-2xl bg-[#121526] border-2 border-[#D4A437]/70 shadow-[0_24px_60px_rgba(0,0,0,0.9)] p-6 sm:p-8"
      style={{ backgroundColor: "#121526", opacity: 1 }}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 group"
          title="Back to Home Screen"
        >
          <img
            src="/brand-logo.png"
            alt="The Missing Piece"
            className="w-10 h-10 rounded-xl border border-amber-400/60 object-cover bg-[#090b14]"
          />
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-widest text-amber-400">
              {isLimitReachedMode
                ? `Daily Free Limit Reached (${MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY}/${MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY})`
                : "Unlimited Interactive Access"}
            </span>
            <h1 className="text-xl font-extrabold text-white group-hover:text-amber-300 transition-colors">
              {gameTitle}
            </h1>
          </div>
        </Link>

        {!isLimitReachedMode ? (
          <button
            type="button"
            onClick={() => setShowKeyModal(false)}
            className="px-3 py-1.5 rounded-lg bg-[#1d2238] hover:bg-[#2a3150] border border-white/15 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="px-3 py-1.5 rounded-lg bg-[#2b1f0d] hover:bg-[#3a2a12] border border-amber-400/50 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
            style={{ backgroundColor: "#2b1f0d", opacity: 1 }}
          >
            🔑 Admin Key Portal
          </button>
        )}
      </div>

      {isLimitReachedMode ? (
        <div className="mb-5 space-y-2.5">
          <p className="text-sm text-slate-200 leading-relaxed">
            You’ve played all{" "}
            <strong className="text-amber-300">
              {MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY} free rounds
            </strong>{" "}
            of <strong className="text-white">{gameTitle}</strong> for today.
            Free rounds reset every day, and you can still play up to{" "}
            {MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY} free rounds on any other
            interactive game.
          </p>
          <p className="text-sm text-slate-300 leading-relaxed">
            Have a Stream Key? Enter it below for{" "}
            <strong className="text-emerald-300">unlimited rounds</strong>{" "}
            across all interactive games.
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-200 leading-relaxed mb-5">
          Free players get{" "}
          <strong className="text-amber-300">
            {MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY} rounds per game per day
          </strong>{" "}
          ({dailyLimit.remaining} left today in {gameTitle}). Enter your
          registered TikTok{" "}
          <code className="text-amber-300 font-mono">@username</code> and{" "}
          <code className="text-amber-300 font-mono">LIVE-xxxx-xxxx</code>{" "}
          stream key to unlock{" "}
          <strong className="text-emerald-300">unlimited usage</strong> across
          all interactive games.
        </p>
      )}

      <form onSubmit={handleUnlockStreamKey} className="space-y-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
            TikTok @Username
          </label>
          <input
            type="text"
            value={usernameInput}
            onChange={(e) => setUsernameInput(e.target.value)}
            placeholder="@yourtiktokhandle"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#090b14] border border-white/20 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
            style={{ backgroundColor: "#090b14", opacity: 1 }}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-200 mb-1.5">
            Stream Key
          </label>
          <input
            type="password"
            value={streamKeyInput}
            onChange={(e) => setStreamKeyInput(e.target.value.toUpperCase())}
            placeholder="LIVE-XXXX-XXXX"
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#090b14] border border-white/20 text-amber-300 font-mono text-sm tracking-wider uppercase focus:outline-none focus:border-amber-400"
            style={{ backgroundColor: "#090b14", opacity: 1 }}
            required
          />
        </div>

        {errorMsg && (
          <div
            className="p-3 rounded-xl bg-[#331019] border border-rose-400/50 text-rose-200 text-xs font-semibold"
            style={{ backgroundColor: "#331019", opacity: 1 }}
          >
            {errorMsg}
          </div>
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-extrabold text-sm tracking-wide shadow-lg cursor-pointer transition-all"
        >
          Unlock Unlimited Interactive Access
        </button>
      </form>

      {/* Contact Info to Arrange a Stream Key */}
      <div className="mt-5 p-3.5 rounded-xl bg-[#1b102d] border border-amber-400/35 text-xs text-slate-200 leading-relaxed">
        <div className="font-bold text-amber-300 mb-1">
          Want a Stream Key for unlimited rounds?
        </div>
        <p>
          Email{" "}
          <a
            href={`mailto:${INTERACTIVE_CONTACT_EMAIL}?subject=${encodeURIComponent("Interactive Stream Key Request")}`}
            className="text-amber-300 hover:text-amber-200 font-bold underline"
          >
            {INTERACTIVE_CONTACT_EMAIL}
          </a>{" "}
          or message{" "}
          <a
            href={INTERACTIVE_CONTACT_TIKTOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-300 hover:text-amber-200 font-bold underline"
          >
            {INTERACTIVE_CONTACT_TIKTOK_HANDLE}
          </a>{" "}
          on TikTok to arrange your personal stream key.
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
        <Link
          to="/interactive-games"
          className="text-slate-200 hover:text-amber-300 font-semibold underline"
        >
          ← Back to Interactive Games
        </Link>
        <button
          type="button"
          onClick={() => {
            setShowKeyModal(false);
            setShowAdminModal(true);
          }}
          className="text-amber-300 hover:text-amber-200 font-semibold underline cursor-pointer"
        >
          Admin Key Portal
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f3fc] text-[#2b0938] dark:bg-[#08090f] dark:text-slate-100 transition-colors">
      {/* Unified Interactive Games Top Bar */}
      <div
        className="sticky top-0 z-50 w-full bg-[#faf7ff] dark:bg-[#0d101b] border-b border-[#4a1259]/20 dark:border-white/15 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm dark:shadow-md transition-colors"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/interactive-games"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#efe7fb] hover:bg-[#e4d5f8] dark:bg-[#181d30] dark:hover:bg-[#232a42] border border-[#4a1259]/20 dark:border-white/15 text-[#2b0938] dark:text-slate-200 font-bold transition-colors whitespace-nowrap shrink-0"
            title="Back to Interactive Games"
          >
            ← Back
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-[#efe7fb] dark:hover:bg-[#181d30] transition-colors group"
            title="Return to The Missing Piece Home Screen"
          >
            <img
              src="/brand-logo.png"
              alt="The Missing Piece Home"
              className="w-6 h-6 rounded-md object-cover border border-amber-500/60 dark:border-amber-400/50"
            />
            <span className="font-extrabold tracking-tight text-[#2b0938] group-hover:text-amber-700 dark:text-white dark:group-hover:text-amber-300 transition-colors whitespace-nowrap">
              The Missing Piece
            </span>
          </Link>

          <span className="hidden md:inline-block text-[#4a1259]/40 dark:text-slate-500">·</span>
          <span className="hidden md:inline-block font-semibold text-amber-700 dark:text-amber-300">
            {gameTitle}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {activeStreamer ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-100 border border-emerald-600/35 text-emerald-900 dark:bg-[#0c2e24] dark:border-emerald-400/50 dark:text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span className="font-mono font-bold">
                {activeStreamer.username}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-600/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                Unlimited
              </span>
              <button
                type="button"
                onClick={() => clearActiveInteractiveStreamerSession()}
                className="ml-1 text-[11px] font-bold text-rose-700 hover:text-rose-800 dark:text-rose-300 dark:hover:text-rose-200 underline cursor-pointer"
              >
                Switch Key
              </button>
            </div>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
                  dailyLimit.remaining > 0
                    ? "bg-amber-100 border-amber-600/35 text-amber-900 dark:bg-[#2b1f0d] dark:border-amber-400/50 dark:text-amber-200"
                    : "bg-rose-100 border-rose-600/35 text-rose-900 dark:bg-[#331019] dark:border-rose-400/50 dark:text-rose-200"
                }`}
                title={`Free users can play up to ${MAX_FREE_INTERACTIVE_ROUNDS_PER_DAY} rounds per game per day. Stream Key holders get unlimited usage.`}
              >
                <span>
                  {dailyLimit.remaining > 0
                    ? `Free Play: ${dailyLimit.remaining}/${dailyLimit.limit} rounds left today`
                    : `Daily Limit Reached (0/${dailyLimit.limit} left)`}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setShowKeyModal(true);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-400/25 hover:bg-amber-400/40 dark:bg-amber-400/20 dark:hover:bg-amber-400/30 border border-amber-600/45 dark:border-amber-400/60 text-amber-950 dark:text-amber-200 font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                🔑 Enter Stream Key
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#f0e6fb] hover:bg-[#e4d3f7] dark:bg-[#26143d] dark:hover:bg-[#331b52] border border-[#4a1259]/30 dark:border-purple-400/45 text-[#2b0938] dark:text-purple-100 font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>👤</span>
            <span>
              {siteUser
                ? `${siteUser.displayName}${siteUser.linkedTikTokHandle ? ` (${normalizeTikTokHandle(siteUser.linkedTikTokHandle)})` : " · Link TikTok @"}`
                : "Account & Link TikTok @"}
            </span>
            {profileScores && profileScores.totalPoints > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-200 text-amber-950 dark:bg-[#3b2a0e] dark:text-amber-300 font-mono text-[10px]">
                {profileScores.totalPoints.toLocaleString()} pts
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={toggleDarkMode}
            title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#efe7fb] hover:bg-[#e4d5f8] dark:bg-[#181d30] dark:hover:bg-[#232a42] border border-[#4a1259]/25 dark:border-white/15 text-[#2b0938] dark:text-amber-300 font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{darkMode ? "Light" : "Dark"}</span>
          </button>
        </div>
      </div>

      {/* Game Area or Daily Limit Wall */}
      {showLimitWall && !activeStreamer ? (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-radial from-purple-200/50 via-[#f7f3fc] to-[#f7f3fc] dark:from-purple-950/40 dark:via-[#08090f] dark:to-[#08090f]">
          {renderKeyCard(true)}
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col">{children}</div>
      )}

      {/* Optional Stream Key Modal for non-key users who want to unlock unlimited play early */}
      {showKeyModal && !activeStreamer && !showLimitWall && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          {renderKeyCard(false)}
        </div>
      )}

      <AdminPortalModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />
      <UnifiedAuthModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={siteUser}
      />
    </div>
  );
}
