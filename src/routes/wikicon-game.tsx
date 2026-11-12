import WikiConApp from "../wikicon/App";
import { InteractiveStreamGate } from "../components/interactive-games/interactive-stream-gate";

export function WikiConGamePage() {
  return (
    <InteractiveStreamGate gameTitle="WikiContexto">
      <WikiConApp />
    </InteractiveStreamGate>
  );
}

export default WikiConGamePage;

