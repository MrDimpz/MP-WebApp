import React, { useMemo, useState } from 'react';
import { Check, Download, Image as ImageIcon, Save, Trash2, X } from 'lucide-react';
import type { RoundArtwork, SavedArtworkRecord } from '../shared/types.ts';
import {
  downloadDataUrl,
  renderArtworkThumbnail,
  renderCommandsToDataUrl,
} from '../utils/canvasEngine.ts';

interface ArtworkGalleryModalProps {
  sessionArtworks: RoundArtwork[];
  savedArtworks: SavedArtworkRecord[];
  roomName: string;
  isGuest: boolean;
  onSaveArtwork: (dataUrl: string, word: string, artistName: string) => Promise<void>;
  onDeleteSavedArtwork: (id: string) => Promise<void>;
  onClose: () => void;
}

export const ArtworkGalleryModal: React.FC<ArtworkGalleryModalProps> = ({
  sessionArtworks,
  savedArtworks,
  roomName,
  isGuest,
  onSaveArtwork,
  onDeleteSavedArtwork,
  onClose,
}) => {
  const [tab, setTab] = useState<'session' | 'saved'>(
    sessionArtworks.length > 0 ? 'session' : 'saved'
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const sessionThumbs = useMemo(() => {
    return sessionArtworks.map((art) => ({
      artwork: art,
      thumbUrl: renderArtworkThumbnail(art),
    }));
  }, [sessionArtworks]);

  const handleDownloadSession = (art: RoundArtwork, framed: boolean) => {
    const url = renderCommandsToDataUrl(art.commands, {
      framed,
      word: art.word,
      artistName: art.drawerName,
      roomName,
    });
    downloadDataUrl(url, `inkstream-${art.word}-${art.drawerName}`);
  };

  const handleSaveSessionToAccount = async (art: RoundArtwork, thumbUrl: string) => {
    setSavingId(art.id);
    try {
      await onSaveArtwork(thumbUrl, art.word, art.drawerName);
      setSavedIds((prev) => new Set(prev).add(art.id));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Artwork Gallery"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900">Artwork Gallery</h2>
              <p className="text-xs text-slate-500">
                Save and download finished drawings as clean or studio-framed PNG images
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close gallery"
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('session')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'session'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Room Session ({sessionArtworks.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('saved')}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                tab === 'saved'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Saved Artworks ({savedArtworks.length})
            </button>
          </div>
          {isGuest && tab === 'saved' && (
            <p className="text-xs text-slate-500">
              Register with email &amp; password to keep saved artworks across sessions.
            </p>
          )}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto thin-scrollbar p-6">
          {tab === 'session' ? (
            sessionThumbs.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-semibold text-slate-800">No completed artworks yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Finished drawings from each turn are automatically collected here for download.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sessionThumbs.map(({ artwork, thumbUrl }) => {
                  const isSaved = savedIds.has(artwork.id);
                  return (
                    <div
                      key={artwork.id}
                      className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col"
                    >
                      <div className="aspect-[4/3] bg-slate-50 border-b border-slate-200 overflow-hidden">
                        <img
                          src={thumbUrl}
                          alt={`${artwork.word} drawn by ${artwork.drawerName}`}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain bg-white"
                        />
                      </div>
                      <div className="p-3.5 flex flex-col gap-2.5">
                        <div>
                          <h3 className="font-display font-bold text-base text-slate-900 capitalize truncate">
                            {artwork.word}
                          </h3>
                          <p className="text-xs text-slate-500">
                            By {artwork.drawerName} · Round {artwork.roundNumber}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDownloadSession(artwork, true)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Framed PNG
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadSession(artwork, false)}
                            title="Download raw canvas PNG"
                            className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            Raw
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveSessionToAccount(artwork, thumbUrl)}
                            disabled={savingId === artwork.id || isSaved}
                            title="Save to your account gallery"
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${
                              isSaved
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {isSaved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : savedArtworks.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-semibold text-slate-800">Your saved gallery is empty</p>
              <p className="text-xs text-slate-500 mt-1">
                Click &ldquo;Save Artwork&rdquo; after any round to store your favorite drawings here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {savedArtworks.map((item) => (
                <div
                  key={item.id}
                  className="border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col"
                >
                  <div className="aspect-[4/3] bg-slate-50 border-b border-slate-200 overflow-hidden">
                    <img
                      src={item.dataUrl}
                      alt={`${item.word} by ${item.artistName}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain bg-white"
                    />
                  </div>
                  <div className="p-3.5 flex flex-col gap-2.5">
                    <div>
                      <h3 className="font-display font-bold text-base text-slate-900 capitalize truncate">
                        {item.word}
                      </h3>
                      <p className="text-xs text-slate-500 truncate">
                        By {item.artistName} · {item.roomName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          downloadDataUrl(item.dataUrl, `inkstream-${item.word}-${item.artistName}`)
                        }
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download PNG
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteSavedArtwork(item.id)}
                        title="Delete artwork"
                        className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        aria-label="Delete saved artwork"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
