import CrowdleApp from '../crowdle/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

export function CrowdleGamePage() {
  return (
    <InteractiveStreamGate gameTitle="Crowdle" gameSlug="crowdle">
      <CrowdleApp />
    </InteractiveStreamGate>
  );
}

export default CrowdleGamePage;
