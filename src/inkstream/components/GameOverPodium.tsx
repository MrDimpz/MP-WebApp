import React, { useMemo, useState } from 'react';
import { BarChart3, Crown, Download, Radio, RotateCcw, Settings, Trophy, Users } from 'lucide-react';
import type { RoomClientState } from '../shared/types.ts';
import {
  downloadDataUrl,
  renderArtworkThumbnail,
  renderCommandsToDataUrl,
} from '../utils/canvasEngine.ts';
import { Avatar } from './Avatar.tsx';

interface GameOverPodiumProps {
  room: RoomClientState;
  isOwner: boolean;
  onPlayAgain: () => void;
  onReturnToLobby: () => void;
  onOpenAnalytics: () => void;
}

export const GameOverPodium: React.FC<GameOverPodiumProps> = ({
  room,
  isOwner,
  onPlayAgain,
  onReturnToLobby,
  onOpenAnalytics,
}) => {
  const hasTikTokWinners = room.tiktokLeaderboard.length > 0;
  const [podiumTab, setPodiumTab] = useState<'room' | 'tiktok'>('room');

  const rankedPlayers = useMemo(
    () => [...room.players].sort((a, b) => b.score - a.score),
    [room.players]
  );

  const rankedTikTok = useMemo(
    () => [...room.tiktokLeaderboard].sort((a, b) => b.score - a.score),
    [room.tiktokLeaderboard]
  );

  const recentThumbs = useMemo(() => {
    return room.artworks.slice(0, 6).map((art) => ({
      artwork: art,
      thumbUrl: renderArtworkThumbnail(art),
    }));
  }, [room.artworks]);

  // 3 podium slots: Left = 2nd, Center = 1st, Right = 3rd
  const roomSlots = [
    { place: 2, player: rankedPlayers[1] ?? null },
    { place: 1, player: rankedPlayers[0] ?? null },
    { place: 3, player: rankedPlayers[2] ?? null },
  ];

  const tiktokSlots = [
    { place: 2, viewer: rankedTikTok[1] ?? null },
    { place: 1, viewer: rankedTikTok[0] ?? null },
    { place: 3, viewer: rankedTikTok[2] ?? null },
  ];

  const activeChampionName =
    podiumTab === 'tiktok'
      ? rankedTikTok[0]
        ? `@${rankedTikTok[0].nickname} (${rankedTikTok[0].score} pts)`
        : 'No TikTok winners yet'
      : rankedPlayers[0]
        ? `${rankedPlayers[0].username} (${rankedPlayers[0].score} pts)`
        : 'Match Complete';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="text-center border-b border-slate-200 pb-5">
        <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-amber-50 text-amber-600 mb-2">
          <Trophy className="w-6 h-6" />
        </div>
        <h2 className="font-display text-3xl font-extrabold text-slate-900">Top 3 Podium</h2>
        <p className="text-sm text-slate-600 mt-1">
          Champion: <span className="font-semibold text-slate-900">{activeChampionName}</span>
        </p>

        {hasTikTokWinners && (
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg mt-4">
            <button
              type="button"
              onClick={() => setPodiumTab('room')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                podiumTab === 'room'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Room Top 3
            </button>
            <button
              type="button"
              onClick={() => setPodiumTab('tiktok')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                podiumTab === 'tiktok'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-rose-600" />
              TikTok Chat Top 3
            </button>
          </div>
        )}
      </div>

      {/* Top 3 Podium Stage (Always renders 2nd - 1st - 3rd pedestals) */}
      {podiumTab === 'room' ? (
        <div className="grid grid-cols-3 gap-3 sm:gap-5 items-end max-w-lg w-full mx-auto pt-4 pb-2">
          {roomSlots.map(({ place, player }) => {
            const pedestalStyle =
              place === 1
                ? 'h-32 bg-amber-100 border-amber-300 text-amber-900'
                : place === 2
                  ? 'h-24 bg-slate-100 border-slate-300 text-slate-700'
                  : 'h-18 bg-orange-50 border-orange-200 text-orange-800';
            const placeLabel = place === 1 ? '1st' : place === 2 ? '2nd' : '3rd';

            return (
              <div key={place} className="flex flex-col items-center text-center min-w-0">
                {player ? (
                  <>
                    <div className="relative flex flex-col items-center">
                      {place === 1 && (
                        <Crown className="w-5 h-5 text-amber-500 mb-1" />
                      )}
                      <Avatar config={player.avatar} size={place === 1 ? 68 : 54} />
                    </div>
                    <p className="font-display font-bold text-sm text-slate-900 mt-2 truncate w-full">
                      {player.username}
                    </p>
                    <p className="font-mono-tabular text-xs font-bold text-blue-700 mb-2">
                      {player.score} pts
                    </p>
                  </>
                ) : (
                  <div className="mb-2 flex flex-col items-center opacity-45">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-xs font-semibold text-slate-400">
                      —
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Open spot</p>
                  </div>
                )}

                <div
                  className={`w-full rounded-t-xl border ${pedestalStyle} flex flex-col items-center justify-center`}
                >
                  <span className="font-display font-extrabold text-2xl">{placeLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:gap-5 items-end max-w-lg w-full mx-auto pt-4 pb-2">
          {tiktokSlots.map(({ place, viewer }) => {
            const pedestalStyle =
              place === 1
                ? 'h-32 bg-amber-100 border-amber-300 text-amber-900'
                : place === 2
                  ? 'h-24 bg-slate-100 border-slate-300 text-slate-700'
                  : 'h-18 bg-orange-50 border-orange-200 text-orange-800';
            const placeLabel = place === 1 ? '1st' : place === 2 ? '2nd' : '3rd';

            return (
              <div key={place} className="flex flex-col items-center text-center min-w-0">
                {viewer ? (
                  <>
                    <div className="relative flex flex-col items-center">
                      {place === 1 && <Crown className="w-5 h-5 text-amber-500 mb-1" />}
                      {viewer.profilePictureUrl ? (
                        <img
                          src={viewer.profilePictureUrl}
                          alt={viewer.nickname}
                          referrerPolicy="no-referrer"
                          className={`${
                            place === 1 ? 'w-16 h-16' : 'w-13 h-13'
                          } rounded-full object-cover border-2 border-slate-900`}
                        />
                      ) : (
                        <div
                          className={`${
                            place === 1 ? 'w-16 h-16 text-xl' : 'w-13 h-13 text-base'
                          } rounded-full bg-slate-900 text-white font-bold flex items-center justify-center`}
                        >
                          {viewer.nickname.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <p className="font-display font-bold text-sm text-slate-900 mt-2 truncate w-full">
                      @{viewer.nickname}
                    </p>
                    <p className="font-mono-tabular text-xs font-bold text-blue-700 mb-2">
                      {viewer.score} pts
                    </p>
                  </>
                ) : (
                  <div className="mb-2 flex flex-col items-center opacity-45">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-slate-300 flex items-center justify-center text-xs font-semibold text-slate-400">
                      —
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Open spot</p>
                  </div>
                )}

                <div
                  className={`w-full rounded-t-xl border ${pedestalStyle} flex flex-col items-center justify-center`}
                >
                  <span className="font-display font-extrabold text-2xl">{placeLabel}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Remaining Rankings (#4+) */}
      {podiumTab === 'room' && rankedPlayers.length > 3 && (
        <div className="border-t border-slate-100 pt-3">
          <div className="divide-y divide-slate-100 max-h-36 overflow-y-auto thin-scrollbar">
            {rankedPlayers.slice(3).map((p, idx) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-mono-tabular font-bold text-slate-400 w-6">
                    #{idx + 4}
                  </span>
                  <Avatar config={p.avatar} size={22} />
                  <span className="font-semibold text-slate-800">{p.username}</span>
                </div>
                <span className="font-mono-tabular font-semibold text-slate-700">
                  {p.score} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session Artworks Highlight Strip */}
      {recentThumbs.length > 0 && (
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-sm text-slate-900">
              Match Artworks ({room.artworks.length})
            </h3>
            <span className="text-xs text-slate-500">Download any finished piece as PNG</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {recentThumbs.map(({ artwork, thumbUrl }) => (
              <div
                key={artwork.id}
                className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50"
              >
                <div className="aspect-[4/3] bg-white border-b border-slate-200">
                  <img
                    src={thumbUrl}
                    alt={`${artwork.word} by ${artwork.drawerName}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="px-2.5 py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-900 capitalize truncate">
                      {artwork.word}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">{artwork.drawerName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const framed = renderCommandsToDataUrl(artwork.commands, {
                        framed: true,
                        word: artwork.word,
                        artistName: artwork.drawerName,
                        roomName: room.settings.name,
                      });
                      downloadDataUrl(framed, `inkstream-${artwork.word}-${artwork.drawerName}`);
                    }}
                    title="Download PNG"
                    className="p-1.5 rounded-md bg-white border border-slate-200 text-slate-700 hover:text-blue-600 hover:border-blue-300 cursor-pointer shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {isOwner ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenAnalytics}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <BarChart3 className="w-4 h-4 text-blue-600" />
                Room Analytics
              </button>
              <button
                type="button"
                onClick={onReturnToLobby}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Settings className="w-4 h-4" />
                Room Settings
              </button>
            </div>
            <button
              type="button"
              onClick={onPlayAgain}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Waiting for the room owner to start the next match...
          </p>
        )}
      </div>
    </div>
  );
};
