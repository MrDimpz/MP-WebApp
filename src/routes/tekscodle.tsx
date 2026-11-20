import { useEffect } from 'react';
import TekscodleApp from '@/tekscodle/App';

export default function TekscodlePage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <TekscodleApp />;
}
