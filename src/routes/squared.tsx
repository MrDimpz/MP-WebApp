import { useEffect } from 'react';
import SquaredApp from '@/squared/App';

export default function SquaredPage() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('theme-classic');
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <SquaredApp />;
}
