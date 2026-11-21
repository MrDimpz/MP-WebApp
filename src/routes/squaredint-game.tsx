import SquaredIntApp from "../squaredint/App";
import { InteractiveStreamGate } from "../components/interactive-games/interactive-stream-gate";

export function SquaredIntGamePage() {
  return (
    <InteractiveStreamGate gameTitle="Squared Interactive" gameSlug="squaredint">
      <SquaredIntApp />
    </InteractiveStreamGate>
  );
}

export default SquaredIntGamePage;

