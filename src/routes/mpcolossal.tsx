import { useEffect } from 'react';
import MPColossalApp from '@/mpcolossal/App';

export default function MPColossalPage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <MPColossalApp />;
}
