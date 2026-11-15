import MPSearchInteractiveApp from '../mpsearchint/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

export function MPSearchIntGamePage() {
  return (
    <InteractiveStreamGate gameTitle="MP Search Interactive">
      <div className="w-screen min-h-screen bg-[#140421]">
        <MPSearchInteractiveApp />
      </div>
    </InteractiveStreamGate>
  );
}

export default MPSearchIntGamePage;
