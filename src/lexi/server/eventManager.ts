export type GameEventType =
  | 'state:sync'
  | 'game:started'
  | 'game:paused'
  | 'game:resumed'
  | 'game:reset'
  | 'round:countdown'
  | 'round:started'
  | 'round:ended'
  | 'round:timer'
  | 'board:generated'
  | 'board:modifier_updated'
  | 'difficulty:adapted'
  | 'word:submitted'
  | 'word:accepted'
  | 'word:rejected'
  | 'hint:revealed'
  | 'score:updated'
  | 'leaderboard:updated'
  | 'gift:received'
  | 'like:updated'
  | 'like:milestone'
  | 'follow:received'
  | 'share:received'
  | 'chat:message'
  | 'command:response'
  | 'tiktok:connected'
  | 'tiktok:disconnected'
  | 'tiktok:error'
  | 'config:updated';

export interface SequencedEvent<T = any> {
  seqId: number;
  type: GameEventType;
  timestamp: number;
  simulated?: boolean;
  payload: T;
}

type Listener = (...args: any[]) => void;

export class EventManager {
  private seqId = 0;
  private recentEvents: SequencedEvent[] = [];
  private readonly maxRecentEvents = 150;
  private listeners: Map<string, Set<Listener>> = new Map();

  public on(event: string, listener: Listener): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return this;
  }

  public off(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  public emit(event: string, ...args: any[]): boolean {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const fn of Array.from(set)) {
      try {
        fn(...args);
      } catch (e) {
        console.error('[EventManager] Listener error:', e);
      }
    }
    return true;
  }

  public emitGameEvent<T>(type: GameEventType, payload: T, simulated = false): SequencedEvent<T> {
    this.seqId += 1;
    const event: SequencedEvent<T> = {
      seqId: this.seqId,
      type,
      timestamp: Date.now(),
      simulated,
      payload,
    };

    if (type !== 'round:timer') {
      this.recentEvents.unshift(event);
      if (this.recentEvents.length > this.maxRecentEvents) {
        this.recentEvents.length = this.maxRecentEvents;
      }
    }

    this.emit('broadcast', event);
    this.emit(type, event);
    return event;
  }

  public getSeqId(): number {
    return this.seqId;
  }

  public getRecentEvents(limit = 50): SequencedEvent[] {
    return this.recentEvents.slice(0, limit);
  }

  public clearRecentEvents(): void {
    this.recentEvents = [];
  }
}

export const eventManager = new EventManager();
