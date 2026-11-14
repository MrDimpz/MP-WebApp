import React, { useEffect, useRef } from 'react';
import { triggerVictoryConfetti } from '@/lib/confetti';

interface VictoryConfettiProps {
  active: boolean;
  isDaily?: boolean;
  isNewHighScore?: boolean;
}

export const VictoryConfetti: React.FC<VictoryConfettiProps> = ({
  active,
  isDaily = false,
  isNewHighScore = false,
}) => {
  const prevActiveRef = useRef(false);

  useEffect(() => {
    if (active && !prevActiveRef.current) {
      triggerVictoryConfetti({
        isDaily,
        isNewHighScore,
      });
    }
    prevActiveRef.current = active;
  }, [active, isDaily, isNewHighScore]);

  return null;
};
