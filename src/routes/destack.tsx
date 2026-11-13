import { useEffect } from 'react';
import DeStackApp from '@/destack/App';

export default function DeStackPage() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  return <DeStackApp />;
}
