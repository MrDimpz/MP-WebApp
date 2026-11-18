import { useEffect } from 'react';
import ThematixApp from '@/thematix/App';

export default function ThematixPage() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('theme-classic');
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <ThematixApp />;
}
