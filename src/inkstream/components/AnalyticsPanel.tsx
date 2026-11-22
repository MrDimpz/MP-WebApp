import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import type { RoomAnalyticsSnapshot, RoundArtwork } from '../shared/types.ts';
import { downloadDataUrl, renderCommandsToDataUrl } from '../utils/canvasEngine.ts';
import { Avatar } from './Avatar.tsx';

interface AnalyticsPanelProps {
  analytics: RoomAnalyticsSnapshot | null;
  artworks: RoundArtwork[];
  isOwner: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const AnalyticsPanel: React.FC<AnalyticsPanelProps> = ({
  analytics,
  artworks,
  isOwner,
  onClose,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'rounds'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const artworkMap = useMemo(() => {
    const map = new Map<string, RoundArtwork>();
    for (const art of artworks) {
      map.set(art.id, art);
    }
    return map;
  }, [artworks]);

  const filteredRounds = useMemo(() => {
    if (!analytics) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return analytics.roundHistory;
    return analytics.roundHistory.filter(
      (r) =>
        r.word.toLowerCase().includes(q) ||
        r.drawerName.toLowerCase().includes(q) ||
        (r.fastestGuesserName && r.fastestGuesserName.toLowerCase().includes(q))
    );
  }, [analytics, searchQuery]);

  const handleExportCsv = () => {
    if (!analytics) return;
    const headers = [
      'Turn',
      'Round',
      'Word',
      'Drawer',
      'Duration (s)',
      'Guessed',
      'Eligible Guessers',
      'Guess Rate (%)',
      'Fastest Guesser',
      'Fastest Time (s)',
      'Avg Guess Time (s)',
      'Strokes',
      'Chat Messages',
      'Likes',
      'Dislikes',
    ];
    const rows = analytics.roundHistory.map((r) => [
      r.turnNumber,
      r.roundNumber,
      `"${r.word.replace(/"/g, '""')}"`,
      `"${r.drawerName.replace(/"/g, '""')}"`,
      r.durationSec,
      r.correctGuessers,
      r.eligibleGuessers,
      r.guessRate,
      r.fastestGuesserName ? `"${r.fastestGuesserName.replace(/"/g, '""')}"` : '',
      r.fastestGuessSec ?? '',
      r.averageGuessSec ?? '',
      r.strokeCount,
      r.chatMessagesCount,
      r.likes,
      r.dislikes,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inkstream-room-${analytics.roomId.toLowerCase()}-analytics.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadRoundArt = (artworkId: string, word: string, drawerName: string) => {
    const art = artworkMap.get(artworkId);
    if (!art) return;
    const dataUrl = renderCommandsToDataUrl(art.commands, {
      framed: true,
      word,
      artistName: drawerName,
      roomName: analytics?.roomName,
    });
    downloadDataUrl(dataUrl, `inkstream-${word}-${drawerName}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Room Analytics"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Top Bar */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-lg text-slate-900 truncate">
                Lobby Owner Analytics
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {analytics
                  ? `${analytics.roomName} · Code ${analytics.roomId} · Peak ${analytics.peakPlayersCount} players`
                  : 'Track player engagement and completed round history'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOwner && analytics && analytics.roundHistory.length > 0 && (
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export CSV
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close analytics"
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        {!isOwner ? (
          <div className="p-10 text-center">
            <h3 className="font-display font-bold text-lg text-slate-900">
              Lobby Owner Access Only
            </h3>
            <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
              Room analytics and player engagement telemetry are available exclusively to the
              current room host. Create a private room to access full analytics.
            </p>
          </div>
        ) : !analytics ? (
          <div className="p-10 text-center">
            <p className="text-sm text-slate-600">Loading room analytics...</p>
            <button
              type="button"
              onClick={onRefresh}
              className="mt-3 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
            >
              Refresh
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto thin-scrollbar p-6 flex flex-col gap-6">
            {/* 4-Column KPI Strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <p className="text-xs font-medium text-slate-500">Turns Completed</p>
                <p className="font-mono-tabular text-2xl font-bold text-slate-900 mt-1">
                  {analytics.totalTurnsCompleted}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {analytics.totalRoundsCompleted} rounds · {analytics.totalStrokesDrawn} strokes
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <p className="text-xs font-medium text-slate-500">Overall Guess Rate</p>
                <p className="font-mono-tabular text-2xl font-bold text-slate-900 mt-1">
                  {analytics.overallGuessRate}%
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Correct guesses per turn
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <p className="text-xs font-medium text-slate-500">Avg. Guess Speed</p>
                <p className="font-mono-tabular text-2xl font-bold text-slate-900 mt-1">
                  {analytics.avgGuessTimeSec !== null ? `${analytics.avgGuessTimeSec}s` : '—'}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Time from turn start to solve
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                <p className="text-xs font-medium text-slate-500">Chat Engagement</p>
                <p className="font-mono-tabular text-2xl font-bold text-slate-900 mt-1">
                  {analytics.totalChatMessages}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {analytics.activePlayersCount} active · {analytics.peakPlayersCount} peak players
                </p>
              </div>
            </div>

            {/* Segmented Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'overview'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Player Engagement ({analytics.playerMetrics.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('rounds')}
                  className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeTab === 'rounds'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Round History ({analytics.roundHistory.length})
                </button>
              </div>

              {activeTab === 'rounds' && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter by word or drawer..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600"
                  />
                </div>
              )}
            </div>

            {/* Player Engagement Data Table */}
            {activeTab === 'overview' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                        <th className="py-2.5 px-4">Player</th>
                        <th className="py-2.5 px-3 text-right">Score</th>
                        <th className="py-2.5 px-3 text-right">Guessed</th>
                        <th className="py-2.5 px-3 text-right">Accuracy</th>
                        <th className="py-2.5 px-3 text-right">Avg Speed</th>
                        <th className="py-2.5 px-3 text-right">Drawer Avg</th>
                        <th className="py-2.5 px-3 text-right">Chat</th>
                        <th className="py-2.5 px-3 text-right">Likes</th>
                        <th className="py-2.5 px-4 text-right">Activity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {analytics.playerMetrics.map((m) => (
                        <tr key={m.playerId} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <Avatar config={m.avatar} size={28} />
                              <span className="font-semibold text-slate-900">{m.username}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular font-semibold text-slate-900">
                            {m.totalScore}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {m.guessesCorrect}/{m.guessesAttempted}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {m.guessAccuracy}%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {m.avgGuessTimeSec !== null ? `${m.avgGuessTimeSec}s` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {m.turnsDrawn > 0 ? `${m.avgPointsAsDrawer} pts` : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {m.messagesSent}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                            {m.likesReceived} / {m.dislikesReceived}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-blue-600 rounded-full"
                                  style={{ width: `${m.engagementIndex}%` }}
                                />
                              </div>
                              <span className="font-mono-tabular text-xs font-semibold text-slate-700 w-7">
                                {m.engagementIndex}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Round History Table */}
            {activeTab === 'rounds' && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {filteredRounds.length === 0 ? (
                  <div className="p-10 text-center text-sm text-slate-500">
                    {analytics.roundHistory.length === 0
                      ? 'Complete at least one drawing turn to populate round history.'
                      : 'No rounds match your filter.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                          <th className="py-2.5 px-4">Round</th>
                          <th className="py-2.5 px-3">Word</th>
                          <th className="py-2.5 px-3">Drawer</th>
                          <th className="py-2.5 px-3 text-right">Solved</th>
                          <th className="py-2.5 px-3">Fastest Guesser</th>
                          <th className="py-2.5 px-3 text-right">Strokes</th>
                          <th className="py-2.5 px-3 text-right">Reactions</th>
                          <th className="py-2.5 px-4 text-right">Artwork</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredRounds.map((row) => (
                          <tr
                            key={`${row.turnNumber}-${row.endedAt}`}
                            className="hover:bg-slate-50/70"
                          >
                            <td className="py-2.5 px-4 font-mono-tabular text-xs text-slate-600">
                              R{row.roundNumber} · T{row.turnNumber}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900 capitalize">
                              {row.word}
                            </td>
                            <td className="py-2.5 px-3 text-slate-700">{row.drawerName}</td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                              {row.correctGuessers}/{row.eligibleGuessers} ({row.guessRate}%)
                            </td>
                            <td className="py-2.5 px-3 text-slate-700 text-xs">
                              {row.fastestGuesserName ? (
                                <span>
                                  {row.fastestGuesserName}{' '}
                                  <span className="font-mono-tabular text-slate-500">
                                    ({row.fastestGuessSec}s)
                                  </span>
                                </span>
                              ) : (
                                <span className="text-slate-400">None</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-slate-700">
                              {row.strokeCount}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-tabular text-xs text-slate-700">
                              <span className="inline-flex items-center gap-1 mr-2 text-emerald-700">
                                <ThumbsUp className="w-3 h-3" />
                                {row.likes}
                              </span>
                              <span className="inline-flex items-center gap-1 text-rose-600">
                                <ThumbsDown className="w-3 h-3" />
                                {row.dislikes}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {artworkMap.has(row.artworkId) ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDownloadRoundArt(row.artworkId, row.word, row.drawerName)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer whitespace-nowrap"
                                >
                                  <Download className="w-3 h-3" />
                                  PNG
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
