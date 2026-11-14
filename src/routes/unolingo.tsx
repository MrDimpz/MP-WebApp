import { useEffect } from 'react';
import UnolingoApp from '@/unolingo/App';

export default function UnolingoPage() {
  useEffect(() => {
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, []);

  return <UnolingoApp />;
}
