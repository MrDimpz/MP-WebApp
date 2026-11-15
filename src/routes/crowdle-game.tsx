import CrowdleApp from '../crowdle/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

export function CrowdleGamePage() {
  return (
    <InteractiveStreamGate gameTitle="Crowdle">
      <CrowdleApp />
    </InteractiveStreamGate>
  );
}

export default CrowdleGamePage;
