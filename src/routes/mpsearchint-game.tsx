import MPSearchInteractiveApp from '../mpsearchint/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';
import { useOverlayConfig } from '../lib/live-overlay';

export function MPSearchIntGamePage() {
  const { isOverlay, bg } = useOverlayConfig();
  return (
    <InteractiveStreamGate gameTitle="MP Search Interactive" gameSlug="mpsearchint">
      <div
        className={`w-screen min-h-screen ${
          isOverlay && bg === 'transparent' ? 'bg-transparent' : 'bg-[#140421]'
        }`}
      >
        <MPSearchInteractiveApp />
      </div>
    </InteractiveStreamGate>
  );
}

export default MPSearchIntGamePage;
