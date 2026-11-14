import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import {
  clearActiveInteractiveStreamerSession,
  getActiveInteractiveStreamerSession,
  touchActiveInteractiveStreamerSession,
  useInteractiveAuthStore,
  validateInteractiveStreamerKey,
} from "../../lib/interactive-key-auth";
import {
  normalizeTikTokHandle,
  setLinkedTikTokHandle,
  useInteractiveProfileScores,
  useUnifiedAuth,
} from "../../lib/unified-game-auth";
import { AdminPortalModal } from "./admin-portal-modal";
import { UnifiedAuthModal } from "../solo-games/unified-auth-modal";
import { getOverlayConfigFromLocation } from "../../lib/live-overlay";

interface InteractiveStreamGateProps {
  gameTitle: string;
  children: React.ReactNode;
}

/**
 * Unifies login across all interactive games, enforces a valid Stream Key
 * (`LIVE-xxxx-xxxx` registered for a `@username`), provides direct Admin Portal
 * access to register stream keys, links Back to `/interactive-games`, and ensures
 * the Brand Logo links back to the Home screen (`/`).
 */
export function InteractiveStreamGate({
  gameTitle,
  children,
}: InteractiveStreamGateProps) {
  const { isOverlay } = getOverlayConfigFromLocation();
  if (isOverlay) {
    return <>{children}</>;
  }
  return <InteractiveStreamGateInner gameTitle={gameTitle}>{children}</InteractiveStreamGateInner>;
}

function InteractiveStreamGateInner({
  gameTitle,
  children,
}: InteractiveStreamGateProps) {
  const { activeStreamer, isAdminAuthenticated } = useInteractiveAuthStore();
  const { user: siteUser } = useUnifiedAuth();
  const profileScores = useInteractiveProfileScores(siteUser?.uid);

  const [usernameInput, setUsernameInput] = useState('');
  const [streamKeyInput, setStreamKeyInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // 15-Minute Inactivity Tracker: Touch session on user interaction and monitor interval
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
        // Automatically expired after 15 minutes of inactivity (from both user and chat)
        clearActiveInteractiveStreamerSession();
      }
    }, 10000); // Check every 10s

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
      streamKeyInput,
    );
    if (!result.valid || !result.streamer) {
      setErrorMsg(
        result.error ||
          "Valid @username and LIVE-xxxx-xxxx stream key required.",
      );
      return;
    }
    if (siteUser && !siteUser.linkedTikTokHandle) {
      setLinkedTikTokHandle(
        siteUser.uid,
        siteUser.displayName || "Player",
        result.streamer.username,
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#08090f] text-slate-100">
      {/* Unified Interactive Games Top Bar: Logo -> Home (/), Back -> /interactive-games, Stream Key Status, Profile & Admin Portal */}
      <div
        className="sticky top-0 z-50 w-full bg-[#0d101b] border-b border-white/15 px-3 sm:px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shadow-md"
        style={{ backgroundColor: "#0d101b", opacity: 1 }}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/interactive-games"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181d30] hover:bg-[#232a42] border border-white/15 text-slate-200 font-bold transition-colors"
            title="Back to Interactive Games"
          >
            ← Back
          </Link>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg hover:bg-[#181d30] transition-colors group"
            title="Return to The Missing Piece Home Screen"
          >
            <img
              src="/brand-logo.png"
              alt="The Missing Piece Home"
              className="w-6 h-6 rounded-md object-cover border border-amber-400/50"
            />
            <span className="font-extrabold tracking-tight text-white group-hover:text-amber-300 transition-colors">
              The Missing Piece
            </span>
          </Link>

          <span className="hidden md:inline-block text-slate-500">·</span>
          <span className="hidden md:inline-block font-semibold text-amber-300">
            {gameTitle}
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {activeStreamer ? (
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#0c2e24] border border-emerald-400/50 text-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono font-bold">
                {activeStreamer.username}
              </span>
              <button
                type="button"
                onClick={() => clearActiveInteractiveStreamerSession()}
                className="ml-1 text-[11px] font-bold text-rose-300 hover:text-rose-200 underline cursor-pointer"
              >
                Switch Key
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#2b1f0d] border border-amber-400/50 text-amber-300 font-semibold">
              🔒 Stream Key Required
            </span>
          )}

          <button
            type="button"
            onClick={() => setShowProfileModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#26143d] hover:bg-[#331b52] border border-purple-400/45 text-purple-100 font-bold transition-colors cursor-pointer"
          >
            <span>👤</span>
            <span>
              {siteUser
                ? `${siteUser.displayName}${siteUser.linkedTikTokHandle ? ` (${normalizeTikTokHandle(siteUser.linkedTikTokHandle)})` : " · Link TikTok @"}`
                : "Account & Link TikTok @"}
            </span>
            {profileScores && profileScores.totalPoints > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-[#3b2a0e] text-amber-300 font-mono text-[10px]">
                {profileScores.totalPoints.toLocaleString()} pts
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Unified Stream Key Requirement Gate if not unlocked yet */}
      {!activeStreamer ? (
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-radial from-purple-950/40 via-[#08090f] to-[#08090f]">
          <div
            className="relative z-20 w-full max-w-lg rounded-2xl bg-[#121526] border-2 border-[#D4A437]/60 shadow-[0_24px_60px_rgba(0,0,0,0.9)] p-6 sm:p-8"
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
                    Unified Interactive Access
                  </span>
                  <h1 className="text-xl font-extrabold text-white group-hover:text-amber-300 transition-colors">
                    {gameTitle}
                  </h1>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="px-3 py-1.5 rounded-lg bg-[#2b1f0d] hover:bg-[#3a2a12] border border-amber-400/50 text-amber-300 text-xs font-bold transition-colors cursor-pointer"
                style={{ backgroundColor: "#2b1f0d", opacity: 1 }}
              >
                🔑 Admin Key Portal
              </button>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed mb-5">
              Enter your registered TikTok <code className="text-amber-300 font-mono">@username</code> and{" "}
              <code className="text-amber-300 font-mono">LIVE-xxxx-xxxx</code> stream key once to unlock all interactive games. Your game instance runs in your own isolated session.
            </p>

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
                Unlock All Interactive Games
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <button
                type="button"
                onClick={() => setShowProfileModal(true)}
                className="text-purple-300 hover:text-purple-200 font-semibold underline cursor-pointer"
              >
                {siteUser
                  ? `Signed in as ${siteUser.displayName} (Manage TikTok @ Link)`
                  : "Sign in to Website Account & Link TikTok @"}
              </button>
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="text-amber-300 hover:text-amber-200 font-semibold underline cursor-pointer"
              >
                Need to register a stream key? Open Admin Portal
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex-1 flex flex-col">{children}</div>
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
