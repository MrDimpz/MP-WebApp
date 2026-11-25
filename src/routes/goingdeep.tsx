import { useEffect } from 'react';
import GoingDeepApp from '@/goingdeep/App';

export default function GoingDeepPage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <GoingDeepApp />;
}
