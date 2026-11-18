import { useEffect } from 'react';
import MPDifferenceApp from '@/mpdifference/App';

export default function MPDifferencePage() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  return <MPDifferenceApp />;
}
