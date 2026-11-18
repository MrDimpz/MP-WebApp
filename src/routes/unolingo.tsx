import { useEffect } from 'react';
import UnolingoApp from '@/unolingo/App';

export default function UnolingoPage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <UnolingoApp />;
}
