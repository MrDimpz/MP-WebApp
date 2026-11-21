import { useEffect } from 'react';
import DeStackIntApp from '../destackint/App';
import { InteractiveStreamGate } from '../components/interactive-games/interactive-stream-gate';

export function DeStackIntGamePage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return (
    <InteractiveStreamGate gameTitle="DeStack Interactive" gameSlug="destackint">
      <DeStackIntApp />
    </InteractiveStreamGate>
  );
}

export default DeStackIntGamePage;
