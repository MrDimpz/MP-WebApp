import { useEffect } from 'react';
import MPDifferenceApp from '@/mpdifference/App';

export default function MPDifferencePage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <MPDifferenceApp />;
}
