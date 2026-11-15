import { useEffect } from 'react';
import MPSearchApp from '@/mpsearch/App';

export default function MPSearchPage() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  return <MPSearchApp />;
}
