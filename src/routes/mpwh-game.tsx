import MpwhApp from '../mpwh/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

function shouldBypassStreamGate(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.endsWith('/overlay')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('overlay') === '1';
}

export function MpwhGamePage() {
  if (shouldBypassStreamGate()) {
    return <MpwhApp />;
  }
  return (
    <InteractiveStreamGate gameTitle="Word Hunt Extreme" gameSlug="mpwh">
      <MpwhApp />
    </InteractiveStreamGate>
  );
}

export default MpwhGamePage;
