import { useEffect } from 'react';
import DeStackApp from '@/destack/App';

export default function DeStackPage() {
  useEffect(() => {
    return () => {
      if (localStorage.getItem('mp_site_dark_mode_v2') !== 'false') {
        document.documentElement.classList.add('dark');
      }
    };
  }, []);

  return <DeStackApp />;
}
