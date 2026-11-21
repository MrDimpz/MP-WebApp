import LexiApp from "../lexi/App";
import { InteractiveStreamGate } from "../components/interactive-games/interactive-stream-gate";

export function LexiGamePage() {
  return (
    <InteractiveStreamGate gameTitle="Lexi Tiles" gameSlug="lexi">
      <LexiApp />
    </InteractiveStreamGate>
  );
}

export default LexiGamePage;

