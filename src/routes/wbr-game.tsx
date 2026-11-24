import WbrApp from '../wbr/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

function shouldBypassStreamGate(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.endsWith('/overlay')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('overlay') === '1';
}

export function WbrGamePage() {
  if (shouldBypassStreamGate()) {
    return <WbrApp />;
  }
  return (
    <InteractiveStreamGate gameTitle="Word Bomb Royale" gameSlug="wbr">
      <WbrApp />
    </InteractiveStreamGate>
  );
}

export default WbrGamePage;
