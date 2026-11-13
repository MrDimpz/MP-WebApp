import { useEffect } from 'react';
import DeStackIntApp from '../destackint/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

export function DeStackIntGamePage() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  return (
    <InteractiveStreamGate gameTitle="DeStack Interactive">
      <DeStackIntApp />
    </InteractiveStreamGate>
  );
}

export default DeStackIntGamePage;
