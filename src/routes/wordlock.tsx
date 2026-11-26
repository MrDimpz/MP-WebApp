import { useEffect } from 'react';
import WordlockApp from '@/wordlock/App';

export default function WordlockPage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <WordlockApp />;
}
