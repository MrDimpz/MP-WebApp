import { useEffect } from 'react';
import WordHuntSoloApp from '@/wordhunt/App';

export default function WordHuntSoloPage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <WordHuntSoloApp />;
}
