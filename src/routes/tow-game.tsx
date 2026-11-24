import TowApp from '../tow/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

function shouldBypassStreamGate(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.endsWith('/overlay')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('overlay') === '1';
}

export function TowGamePage() {
  if (shouldBypassStreamGate()) {
    return <TowApp />;
  }
  return (
    <InteractiveStreamGate gameTitle="Tug of Words" gameSlug="tow">
      <TowApp />
    </InteractiveStreamGate>
  );
}

export default TowGamePage;
