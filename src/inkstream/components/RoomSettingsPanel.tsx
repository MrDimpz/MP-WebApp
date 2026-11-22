import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  EyeOff,
  Globe,
  Lock,
  Play,
  Radio,
  Sparkles,
  Users,
} from 'lucide-react';
import type { RoomClientState, RoomSettings } from '../shared/types.ts';

interface RoomSettingsPanelProps {
  room: RoomClientState;
  isOwner: boolean;
  streamerPopupUrl: string | null;
  onUpdateSettings: (patch: Partial<RoomSettings>) => void;
  onStartGame: (solo: boolean) => void;
  onOpenTikTokModal: () => void;
  errorMessage: string | null;
}

export const RoomSettingsPanel: React.FC<RoomSettingsPanelProps> = ({
  room,
  isOwner,
  streamerPopupUrl,
  onUpdateSettings,
  onStartGame,
  onOpenTikTokModal,
  errorMessage,
}) => {
  const [name, setName] = useState(room.settings.name);
  const [customWordsText, setCustomWordsText] = useState(
    room.settings.customWords.join(', ')
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPopupLink, setCopiedPopupLink] = useState(false);

  useEffect(() => {
    setName(room.settings.name);
    setCustomWordsText(room.settings.customWords.join(', '));
  }, [room.settings.name, room.settings.customWords]);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}?room=${room.id}`
      : `?room=${room.id}`;

  const copyText = async (text: string, onSuccess: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onSuccess();
    } catch {
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      onSuccess();
    }
  };

  const commitCustomWords = () => {
    const parsed = customWordsText
      .split(',')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 2);
    onUpdateSettings({ customWords: parsed });
  };

  const playerCount = room.players.length;
  const tiktokConnected = room.tiktokStatus.connected;

  return (
    <div className="p-6 flex flex-col gap-5">
      {/* Header + Room Invite Code */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <p className="text-xs font-medium text-slate-500">
            {room.settings.isPrivate ? 'Private Room' : 'Public Room'} · Code{' '}
            <span className="font-mono-tabular font-bold text-slate-900">{room.id}</span>
            {room.settings.streamerMode && ' · Streamer Mode'}
          </p>
          <h2 className="text-2xl font-bold text-slate-900 mt-0.5">{room.settings.name}</h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              void copyText(inviteUrl, () => {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              })
            }
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
              copiedLink
                ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                : 'bg-white border-slate-300 text-slate-800 hover:bg-slate-50'
            }`}
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedLink ? 'Invite Link Copied' : 'Copy Invite Link'}
          </button>
        </div>
      </div>

      {/* Streamer & TikTok LIVE Controls Strip */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="inline-flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              disabled={!isOwner}
              checked={room.settings.streamerMode}
              onChange={(e) => onUpdateSettings({ streamerMode: e.target.checked })}
              className="mt-0.5 rounded border-slate-300 accent-blue-600"
            />
            <div>
              <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <EyeOff className="w-4 h-4 text-blue-600" />
                Streamer Mode (Hide Word Choices on Main Screen)
              </span>
              <p className="text-xs text-slate-500 mt-0.5">
                When it&apos;s your turn to draw, pick and view your secret word in a separate
                private popup window.
              </p>
            </div>
          </label>

          {isOwner && (
            <button
              type="button"
              onClick={onOpenTikTokModal}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                tiktokConnected
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                  : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              {tiktokConnected
                ? `TikTok: @${room.tiktokStatus.username}`
                : 'Connect TikTok LIVE'}
            </button>
          )}
        </div>

        {isOwner && room.settings.streamerMode && streamerPopupUrl && (
          <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-600">
              Open on a second screen, phone, or separate browser window before starting:
            </span>
            <div className="flex items-center gap-2">
              <a
                href={streamerPopupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Private Word Popup
              </a>
              <button
                type="button"
                onClick={() =>
                  void copyText(streamerPopupUrl, () => {
                    setCopiedPopupLink(true);
                    setTimeout(() => setCopiedPopupLink(false), 1800);
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-100 cursor-pointer whitespace-nowrap"
              >
                {copiedPopupLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPopupLink ? 'Copied' : 'Copy Popup URL'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Room Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Room Name</label>
          <input
            type="text"
            value={name}
            disabled={!isOwner}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              if (name.trim() && name !== room.settings.name) {
                onUpdateSettings({ name: name.trim() });
              }
            }}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Room Access</label>
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => onUpdateSettings({ isPrivate: true })}
              className={`inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:cursor-default ${
                room.settings.isPrivate
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              Private (Invite)
            </button>
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => onUpdateSettings({ isPrivate: false })}
              className={`inline-flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer disabled:cursor-default ${
                !room.settings.isPrivate
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Public Lobby
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Max Players (up to 20)</label>
          <select
            disabled={!isOwner}
            value={room.settings.maxPlayers}
            onChange={(e) => onUpdateSettings({ maxPlayers: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 font-mono-tabular"
          >
            {[2, 4, 6, 8, 10, 12, 16, 20].map((n) => (
              <option key={n} value={n}>
                {n} Players
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Rounds</label>
          <select
            disabled={!isOwner}
            value={room.settings.rounds}
            onChange={(e) => onUpdateSettings({ rounds: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 font-mono-tabular"
          >
            {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'Round' : 'Rounds'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-700">Draw Time per Turn</label>
          <select
            disabled={!isOwner}
            value={room.settings.drawTime}
            onChange={(e) => onUpdateSettings({ drawTime: Number(e.target.value) })}
            className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 font-mono-tabular"
          >
            {[30, 45, 60, 80, 100, 120, 150, 180].map((sec) => (
              <option key={sec} value={sec}>
                {sec} seconds
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Word Choices</label>
            <select
              disabled={!isOwner}
              value={room.settings.wordChoices}
              onChange={(e) => onUpdateSettings({ wordChoices: Number(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 font-mono-tabular"
            >
              {[2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} words
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Letter Hints</label>
            <select
              disabled={!isOwner}
              value={room.settings.hintsCount}
              onChange={(e) => onUpdateSettings({ hintsCount: Number(e.target.value) })}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 disabled:bg-slate-50 disabled:text-slate-500 font-mono-tabular"
            >
              {[0, 1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'hint' : 'hints'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Custom Words Input */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-700">
            Custom Words (optional, comma-separated)
          </label>
          <label className="inline-flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              disabled={!isOwner}
              checked={room.settings.customWordsOnly}
              onChange={(e) => onUpdateSettings({ customWordsOnly: e.target.checked })}
              className="rounded border-slate-300 accent-blue-600"
            />
            Use custom words only
          </label>
        </div>
        <textarea
          rows={2}
          disabled={!isOwner}
          value={customWordsText}
          onChange={(e) => setCustomWordsText(e.target.value)}
          onBlur={commitCustomWords}
          placeholder="e.g. espresso, skateboard, origami crane, nebula"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600/30 focus:border-blue-600 resize-none"
        />
      </div>

      {errorMessage && (
        <div className="px-3.5 py-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs font-medium text-rose-700">
          {errorMessage}
        </div>
      )}

      {/* Start Game Actions */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <Users className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            {playerCount < 2 && tiktokConnected
              ? `TikTok LIVE (@${room.tiktokStatus.username}) ready to guess!`
              : playerCount < 2
                ? 'Share the invite link, connect TikTok LIVE, or practice solo.'
                : `${playerCount}/${room.settings.maxPlayers} players ready in the lobby.`}
          </span>
        </div>

        {isOwner ? (
          <div className="flex items-center gap-2 shrink-0">
            {playerCount < 2 && !tiktokConnected && (
              <button
                type="button"
                onClick={() => onStartGame(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                Practice Solo
              </button>
            )}
            <button
              type="button"
              onClick={() => onStartGame(false)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              {playerCount < 2 && tiktokConnected ? 'Start Live Stream Match' : 'Start Game'}
            </button>
          </div>
        ) : (
          <span className="text-sm font-medium text-slate-600">
            Waiting for the room owner to start...
          </span>
        )}
      </div>
    </div>
  );
};
