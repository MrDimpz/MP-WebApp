import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';

export function getOrInitTabSessionId(): string {
  return getCurrentUserSessionPrefix();
}
