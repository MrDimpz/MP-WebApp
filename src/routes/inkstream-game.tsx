import InkStreamApp from '../inkstream/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

function shouldBypassStreamGate(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.location.pathname.endsWith('/overlay')) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('streamerPopup') === '1' || params.get('overlay') === '1';
}

export function InkStreamGamePage() {
  if (shouldBypassStreamGate()) {
    return <InkStreamApp />;
  }
  return (
    <InteractiveStreamGate gameTitle="InkStream" gameSlug="inkstream">
      <InkStreamApp />
    </InteractiveStreamGate>
  );
}

export default InkStreamGamePage;
