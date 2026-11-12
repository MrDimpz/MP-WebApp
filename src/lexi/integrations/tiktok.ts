import { io, Socket } from 'socket.io-client';
import {
  attachResilientChatListeners,
  createEventDeduplicator,
  forceReconnectBridge,
  normalizeIncomingChatPayload,
  triggerResilientConnect,
} from '@/lib/live-chat-bridge';
import { getCurrentUserSessionPrefix } from '@/lib/unified-game-auth';
import { touchActiveInteractiveStreamerSession } from '@/lib/interactive-key-auth';
import { gameEngine } from '../server/gameEngine.ts';
import { eventManager } from '../server/eventManager.ts';
import { chatHandler } from './chatHandler.ts';
import { giftHandler } from './giftHandler.ts';
import { liveEventsHandler } from './liveEvents.ts';

export type TikTokConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'ERROR';

export interface TikTokConnectionLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
}

export class TikTokIntegrationService {
  private socket: Socket | null = null;
  private deduplicator = createEventDeduplicator();
  private status: TikTokConnectionStatus = 'DISCONNECTED';
  private username = '';
  private roomId: string | null = null;
  private viewerCount = 0;
  private lastError: string | null = null;
  private logs: TikTokConnectionLog[] = [];

  constructor() {
    const savedUsername = gameEngine.getSettingsConfig().tiktok.username;
    if (savedUsername) {
      this.username = savedUsername;
    }
    this.initBridge();
  }

  private initBridge(): void {
    if (typeof window === 'undefined') return;

    try {
      const s = io({
        reconnectionAttempts: 5,
        timeout: 5000,
        query: {
          sessionId: getCurrentUserSessionPrefix(),
          gameId: 'lexi',
        },
      });
      this.socket = s;

      s.on('tiktok-connected', (data: { username?: string; roomId?: string }) => {
        touchActiveInteractiveStreamerSession();
        const cleanUser = data?.username || this.username || 'streamer';
        this.username = cleanUser;
        this.status = 'CONNECTED';
        this.roomId = data?.roomId || `live-${cleanUser}`;
        this.lastError = null;
        this.addLog('info', `Connected to @${cleanUser} LIVE (Room ID: ${this.roomId})`);
        eventManager.emitGameEvent('tiktok:connected', this.getState());
      });

      s.on('tiktok-disconnected', () => {
        this.status = 'DISCONNECTED';
        this.addLog('warn', `TikTok WebSocket disconnected.`);
        eventManager.emitGameEvent('tiktok:disconnected', this.getState());
      });

      s.on('chat-message', (raw: any) => {
        touchActiveInteractiveStreamerSession();
        const data = normalizeIncomingChatPayload(raw);
        if (!data || !this.deduplicator.shouldProcess('chat', data)) return;
        chatHandler.handleIncomingChat({
          userId: data.uniqueId,
          username: data.uniqueId,
          nickname: data.nickname || data.uniqueId,
          avatarUrl: data.profilePictureUrl,
          comment: data.comment,
          simulated: false,
        });
      });

      s.on('like-event', (raw: any) => {
        const norm = normalizeIncomingChatPayload({ ...raw, comment: 'like' });
        const likeEv = {
          eventId: raw?.eventId,
          uniqueId: norm?.uniqueId || raw?.uniqueId || 'viewer',
          nickname: norm?.nickname || raw?.nickname || 'Viewer',
          likeCount: Number(raw?.likeCount ?? raw?.count) || 1,
          totalLikeCount: Number(raw?.totalLikeCount ?? raw?.total) || 1,
          profilePictureUrl: norm?.profilePictureUrl || raw?.profilePictureUrl,
        };
        if (!this.deduplicator.shouldProcess('like', likeEv)) return;
        liveEventsHandler.handleLikeEvent(
          {
            userId: likeEv.uniqueId,
            username: likeEv.uniqueId,
            nickname: likeEv.nickname,
            avatarUrl: likeEv.profilePictureUrl,
            likeCount: likeEv.likeCount,
            totalLikeCount: likeEv.totalLikeCount,
          },
          false
        );
      });

      s.on('gift-event', (raw: any) => {
        if (raw?.repeatEnd === false) return;
        const norm = normalizeIncomingChatPayload({ ...raw, comment: 'gift' });
        const giftEv = {
          eventId: raw?.eventId,
          uniqueId: norm?.uniqueId || raw?.uniqueId || 'viewer',
          nickname: norm?.nickname || raw?.nickname || 'Viewer',
          giftName: String(raw?.giftName || raw?.gift?.name || 'Gift'),
          diamondCount: Number(raw?.diamondCount ?? raw?.gift?.diamondCount) || 1,
          repeatCount: Number(raw?.repeatCount) || 1,
          profilePictureUrl: norm?.profilePictureUrl || raw?.profilePictureUrl,
        };
        if (!this.deduplicator.shouldProcess('gift', giftEv)) return;
        giftHandler.processGiftEvent(
          {
            userId: giftEv.uniqueId,
            username: giftEv.uniqueId,
            nickname: giftEv.nickname,
            avatarUrl: giftEv.profilePictureUrl,
            giftName: giftEv.giftName,
            diamondCount: giftEv.diamondCount,
            repeatCount: giftEv.repeatCount,
            repeatEnd: true,
          },
          false
        );
      });
    } catch (err) {
      console.error('Error initializing TikTok socket:', err);
    }

    attachResilientChatListeners({
      deduplicator: this.deduplicator,
      onChat: (data) => {
        touchActiveInteractiveStreamerSession();
        chatHandler.handleIncomingChat({
          userId: data.uniqueId,
          username: data.uniqueId,
          nickname: data.nickname || data.uniqueId,
          avatarUrl: data.profilePictureUrl,
          comment: data.comment,
          simulated: false,
        });
      },
      onLike: (data) => {
        liveEventsHandler.handleLikeEvent(
          {
            userId: data.uniqueId,
            username: data.uniqueId,
            nickname: data.nickname || data.uniqueId,
            avatarUrl: data.profilePictureUrl,
            likeCount: data.likeCount || 1,
            totalLikeCount: data.totalLikeCount || 1,
          },
          false
        );
      },
      onGift: (data) => {
        if (data.repeatEnd === false) return;
        giftHandler.processGiftEvent(
          {
            userId: data.uniqueId,
            username: data.uniqueId,
            nickname: data.nickname || data.uniqueId,
            avatarUrl: data.profilePictureUrl,
            giftName: data.giftName || 'Gift',
            diamondCount: data.diamondCount || 1,
            repeatCount: data.repeatCount || 1,
            repeatEnd: true,
          },
          false
        );
      },
    });
  }

  private addLog(level: 'info' | 'warn' | 'error', message: string): void {
    const entry: TikTokConnectionLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      level,
      message,
      timestamp: Date.now(),
    };
    this.logs.unshift(entry);
    if (this.logs.length > 80) {
      this.logs.length = 80;
    }
  }

  public getState() {
    return {
      status: this.status,
      username: this.username,
      roomId: this.roomId,
      viewerCount: this.viewerCount,
      lastError: this.lastError,
      logs: this.logs.slice(0, 40),
    };
  }

  public async connect(rawUsername?: string): Promise<{
    success: boolean;
    status: TikTokConnectionStatus;
    roomId?: string | null;
    error?: string;
  }> {
    const cleanUsername = String(rawUsername ?? this.username ?? '')
      .trim()
      .replace(/^@/, '');

    if (!cleanUsername) {
      this.status = 'ERROR';
      this.lastError = 'Please enter a valid TikTok LIVE username.';
      this.addLog('error', this.lastError);
      return { success: false, status: this.status, error: this.lastError };
    }

    this.username = cleanUsername;
    gameEngine.updateSettingsConfig({
      tiktok: {
        ...gameEngine.getSettingsConfig().tiktok,
        username: cleanUsername,
      },
    });

    this.status = 'CONNECTING';
    this.lastError = null;
    this.addLog('info', `Connecting to TikTok LIVE stream for @${cleanUsername}...`);

    triggerResilientConnect(
      this.socket,
      { username: cleanUsername },
      (info) => {
        this.status = 'CONNECTED';
        this.roomId = info.roomId || `live-${cleanUsername}`;
        this.lastError = null;
        this.addLog('info', `Connected to @${info.username} LIVE (Room ID: ${this.roomId})`);
        eventManager.emitGameEvent('tiktok:connected', this.getState());
      }
    );

    return {
      success: true,
      status: this.status,
      roomId: this.roomId,
    };
  }

  public async disconnect(): Promise<void> {
    if (this.socket) {
      try {
        this.socket.emit('disconnect-tiktok');
      } catch {}
    }
    this.status = 'DISCONNECTED';
    this.roomId = null;
    this.viewerCount = 0;
    this.lastError = null;
    this.addLog('info', `Disconnected from @${this.username || 'TikTok LIVE'}.`);
    eventManager.emitGameEvent('tiktok:disconnected', this.getState());
  }

  public async reconnect(): Promise<{
    success: boolean;
    status: TikTokConnectionStatus;
    roomId?: string | null;
    error?: string;
  }> {
    const cleanUsername = (this.username || gameEngine.getSettingsConfig().tiktok.username || 'streamer')
      .trim()
      .replace(/^@/, '');
    this.addLog('info', `Manual reconnect requested for @${cleanUsername}...`);

    forceReconnectBridge(
      this.socket,
      { username: cleanUsername },
      (info) => {
        this.status = 'CONNECTED';
        this.roomId = info.roomId || `live-${cleanUsername}`;
        this.lastError = null;
        this.addLog('info', `Reconnected to @${info.username} LIVE (Room ID: ${this.roomId})`);
        eventManager.emitGameEvent('tiktok:connected', this.getState());
      }
    );

    return {
      success: true,
      status: this.status,
      roomId: this.roomId,
    };
  }

  public simulateEvent(params: {
    type:
      | 'chat_valid'
      | 'chat_invalid'
      | 'chat_duplicate'
      | 'chat_custom'
      | 'command'
      | 'gift_small'
      | 'gift_medium'
      | 'gift_large'
      | 'gift_streak'
      | 'like'
      | 'follow'
      | 'share'
      | 'connection_error';
    username?: string;
    text?: string;
    giftId?: number;
    repeatCount?: number;
    likeCount?: number;
  }) {
    const simUser = {
      userId: `sim_${(params.username || 'StreamFan99').toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      username: params.username || 'streamfan99',
      nickname: params.username || 'StreamFan99',
    };

    this.addLog('info', `[SIMULATION] Triggered simulated event: ${params.type} by ${simUser.nickname}`);

    switch (params.type) {
      case 'chat_valid': {
        const state = gameEngine.getFullState();
        const discoveredSet = new Set(state.discoveredWords.map((d) => d.word.toLowerCase()));
        const possible = gameEngine['currentBoard'].possibleWords.filter((w) => !discoveredSet.has(w));
        const chosenWord = possible.length > 0 ? possible[Math.floor(Math.random() * possible.length)] : 'STREAM';
        return chatHandler.handleIncomingChat({
          ...simUser,
          comment: chosenWord.toUpperCase(),
          simulated: true,
        });
      }
      case 'chat_invalid': {
        return chatHandler.handleIncomingChat({
          ...simUser,
          comment: params.text || 'ZZZZZZ',
          simulated: true,
        });
      }
      case 'chat_duplicate': {
        const state = gameEngine.getFullState();
        const existingWord = state.discoveredWords[0]?.word || 'APPLE';
        return chatHandler.handleIncomingChat({
          ...simUser,
          comment: existingWord,
          simulated: true,
        });
      }
      case 'chat_custom':
      case 'command': {
        return chatHandler.handleIncomingChat({
          ...simUser,
          comment: params.text || '!score',
          simulated: true,
        });
      }
      case 'gift_small': {
        return giftHandler.processGiftEvent(
          {
            ...simUser,
            giftId: 5655,
            giftName: 'Rose',
            diamondCount: 1,
            repeatCount: params.repeatCount || 1,
            repeatEnd: true,
            giftType: 1,
          },
          true
        );
      }
      case 'gift_medium': {
        return giftHandler.processGiftEvent(
          {
            ...simUser,
            giftId: 5879,
            giftName: 'Doughnut',
            diamondCount: 30,
            repeatCount: params.repeatCount || 1,
            repeatEnd: true,
            giftType: 0,
          },
          true
        );
      }
      case 'gift_large': {
        return giftHandler.processGiftEvent(
          {
            ...simUser,
            giftId: 5999,
            giftName: 'Galaxy',
            diamondCount: 1000,
            repeatCount: 1,
            repeatEnd: true,
            giftType: 0,
          },
          true
        );
      }
      case 'gift_streak': {
        giftHandler.processGiftEvent(
          {
            ...simUser,
            giftId: 5487,
            giftName: 'Finger Heart',
            diamondCount: 5,
            repeatCount: 2,
            repeatEnd: false,
            giftType: 1,
            groupId: 'sim-streak-1',
          },
          true
        );
        return giftHandler.processGiftEvent(
          {
            ...simUser,
            giftId: 5487,
            giftName: 'Finger Heart',
            diamondCount: 5,
            repeatCount: params.repeatCount || 5,
            repeatEnd: true,
            giftType: 1,
            groupId: 'sim-streak-1',
          },
          true
        );
      }
      case 'like': {
        return liveEventsHandler.handleLikeEvent(
          {
            ...simUser,
            likeCount: params.likeCount || 50,
          },
          true
        );
      }
      case 'follow': {
        return liveEventsHandler.handleFollowEvent(simUser, true);
      }
      case 'share': {
        return liveEventsHandler.handleShareEvent(simUser, true);
      }
      case 'connection_error': {
        const errText = '[SIMULATED] TikTok WebSocket connection interrupted (Peer reset).';
        this.lastError = errText;
        this.addLog('error', errText);
        eventManager.emitGameEvent(
          'tiktok:error',
          {
            username: this.username || 'simulated_host',
            error: errText,
            state: this.getState(),
          },
          true
        );
        return { simulatedError: errText };
      }
    }
  }
}

export const tiktokService = new TikTokIntegrationService();
