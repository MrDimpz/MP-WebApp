import { useEffect } from 'react';
import RebusApp from '@/rebus/App';

export default function RebusPage() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('theme-classic');
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <RebusApp />;
}
