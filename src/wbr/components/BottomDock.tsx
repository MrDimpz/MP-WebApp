import {
  ChevronDown,
  ChevronUp,
  Pause,
  Play,
  Radio,
  RefreshCw,
  ShoppingBag,
  SkipForward,
  SlidersHorizontal,
  Terminal,
  Trash2,
} from 'lucide-react';
import { SmoothMarquee } from '../../components/smooth-marquee';

export type HostDrawerTab = 'chat' | 'store' | 'rules' | 'bridge';

interface BottomDockProps {
  burnedWords: string[];
  isPaused: boolean;
  controlsCollapsed: boolean;
  coins: number;
  simEnabled: boolean;
  isLiveConnected?: boolean;
  isOverlay?: boolean;
  onTogglePause: () => void;
  onSkipPhase: () => void;
  onForceNewPrompt: () => void;
  onClearLeaderboard: () => void;
  onToggleCollapse: () => void;
  onOpenDrawer: (tab: HostDrawerTab) => void;
}

export function BottomDock({
  burnedWords,
  isPaused,
  controlsCollapsed,
  coins,
  simEnabled,
  isLiveConnected = false,
  isOverlay = false,
  onTogglePause,
  onSkipPhase,
  onForceNewPrompt,
  onClearLeaderboard,
  onToggleCollapse,
  onOpenDrawer,
}: BottomDockProps) {
  const recentWords = burnedWords.slice(0, 26);

  return (
    <footer
      className={`${
        isOverlay ? 'h-[12%] min-h-[64px]' : 'h-[18%] min-h-[106px]'
      } w-full shrink-0 px-3 pt-1.5 pb-2 flex flex-col justify-between border-t border-[#F6C915]/25 bg-[#180424]/96 relative z-20`}
    >
      {/* Burned Words Ticker Wall */}
      <div className="flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-purple-200/75 mb-1">
          <span>
            BURNED WORDS <span className="text-purple-400/50">·</span>{' '}
            <span className="font-mono tabular-nums text-[#FF2A6D]">
              {burnedWords.length} TAKEN
            </span>
          </span>
          {!isOverlay && (
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums text-[#F6C915]">
                {coins} COINS
              </span>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="flex items-center gap-0.5 text-purple-200/75 hover:text-[#F6C915] transition-colors cursor-pointer"
                title={controlsCollapsed ? 'Expand host controls' : 'Collapse host controls'}
              >
                <span>HOST</span>
                {controlsCollapsed ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Smooth Auto-Scrolling Burned Words Marquee */}
        <div className="w-full overflow-hidden rounded-lg bg-[#24073A] border border-[#D4A437]/25 py-1 min-h-[30px] flex items-center relative">
          {recentWords.length === 0 ? (
            <span className="text-[11px] text-purple-200/60 font-medium px-2.5 truncate">
              Words used in this wave appear here so chat avoids repeats…
            </span>
          ) : (
            <SmoothMarquee
              items={recentWords}
              getItemKey={(word) => word}
              speedPxPerSec={46}
              gapPx={12}
              heightClassName="h-[22px]"
              order="newest-first"
              ariaLabel="Burned words marquee"
              renderItem={(word, idx) => (
                <span className="inline-flex items-center gap-2.5 shrink-0">
                  <span
                    className={`font-mono text-[11.5px] font-bold tracking-wide ${
                      idx === 0
                        ? 'text-[#F6C915]'
                        : idx < 4
                          ? 'text-purple-100'
                          : 'text-purple-300/60 line-through decoration-[#FF2A6D]/75'
                    }`}
                  >
                    {word}
                  </span>
                  <span className="text-purple-400/50 text-[10px]">·</span>
                </span>
              )}
            />
          )}
        </div>
      </div>

      {/* Collapsible Streamer Host Control Bar (hidden in LIVE overlay mode) */}
      {!isOverlay && !controlsCollapsed && (
        <div className="pt-1.5 flex items-center gap-1 w-full overflow-hidden">
          <button
            type="button"
            onClick={onTogglePause}
            title={isPaused ? 'Resume Auto-Loop' : 'Pause Auto-Loop'}
            className={`h-7 flex-1 min-w-0 px-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              isPaused
                ? 'bg-[#F6C915] text-[#180424]'
                : 'bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30'
            }`}
          >
            {isPaused ? <Play className="w-3 h-3 shrink-0" /> : <Pause className="w-3 h-3 shrink-0" />}
            <span className="truncate">{isPaused ? 'Play' : 'Pause'}</span>
          </button>

          <button
            type="button"
            onClick={onSkipPhase}
            title="Skip Current Wave / Phase"
            className="h-7 flex-1 min-w-0 px-1.5 rounded-md text-[10px] font-bold bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <SkipForward className="w-3 h-3 text-[#F6C915] shrink-0" />
            <span className="truncate">Skip</span>
          </button>

          <button
            type="button"
            onClick={onForceNewPrompt}
            title="Force New Prompt"
            aria-label="Force New Prompt"
            className="h-7 w-7 rounded-md bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3 h-3 text-[#F6C915]" />
          </button>

          <button
            type="button"
            onClick={onClearLeaderboard}
            title="Clear Session Hall of Fame"
            aria-label="Clear Session Hall of Fame"
            className="h-7 w-7 rounded-md bg-[#2B0938] hover:bg-[#431032] text-purple-200 hover:text-[#FF2A6D] border border-[#D4A437]/30 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => onOpenDrawer('store')}
            title="Themed Avatar Store"
            className="h-7 flex-1 min-w-0 px-1.5 rounded-md text-[10px] font-bold bg-[#2B0938] hover:bg-[#3A0E4D] text-[#F6C915] border border-[#F6C915]/40 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ShoppingBag className="w-3 h-3 shrink-0" />
            <span className="truncate">Store</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDrawer('rules')}
            title="Customize Game Rules"
            className="h-7 flex-1 min-w-0 px-1.5 rounded-md text-[10px] font-bold bg-[#2B0938] hover:bg-[#3A0E4D] text-purple-100 border border-[#D4A437]/30 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3 h-3 text-[#F6C915] shrink-0" />
            <span className="truncate">Rules</span>
          </button>

          <button
            type="button"
            onClick={() => onOpenDrawer(isLiveConnected ? 'bridge' : 'chat')}
            title="Open Chat Simulator & TikTok LIVE Bridge"
            className={`h-7 flex-1 min-w-0 px-1.5 rounded-md text-[10px] font-extrabold flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
              isLiveConnected
                ? 'bg-emerald-400 hover:bg-emerald-300 text-[#180424]'
                : 'bg-[#F6C915] hover:bg-[#FFE047] text-[#180424]'
            }`}
          >
            {isLiveConnected ? (
              <Radio className="w-3 h-3 shrink-0" />
            ) : (
              <Terminal className="w-3 h-3 shrink-0" />
            )}
            <span className="truncate">{isLiveConnected ? 'LIVE' : simEnabled ? 'Chat' : 'Bridge'}</span>
          </button>
        </div>
      )}
    </footer>
  );
}
