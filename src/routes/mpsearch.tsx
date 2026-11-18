import { useEffect } from 'react';
import MPSearchApp from '@/mpsearch/App';

export default function MPSearchPage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <MPSearchApp />;
}
