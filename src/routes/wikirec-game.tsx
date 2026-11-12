import WikiRecApp from "../wikirec/App";
import { InteractiveStreamGate } from "../components/interactive-games/interactive-stream-gate";

export function WikiRecGamePage() {
  return (
    <InteractiveStreamGate gameTitle="WiKirecTangled">
      <WikiRecApp />
    </InteractiveStreamGate>
  );
}

export default WikiRecGamePage;

