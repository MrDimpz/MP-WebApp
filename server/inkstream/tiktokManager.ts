import {
  ControlEvent,
  TikTokLiveConnection,
  WebcastEvent,
} from 'tiktok-live-connector';
import type { TikTokStatus } from '../../src/inkstream/shared/types.ts';

export interface IncomingTikTokChat {
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  comment: string;
}

export interface TikTokRoomBridgeCallbacks {
  onChat: (chat: IncomingTikTokChat) => void;
  onStatusChange: (status: TikTokStatus) => void;
}

function cleanUrl(val: unknown): string {
  if (!val || typeof val !== 'string') return '';
  const s = val.trim();
  if (!s || s === 'undefined' || s === 'null') return '';
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  return '';
}

// Mirrors MP-WebApp deep TikTok profile picture extraction across v2 webcast payload shapes
export function extractTikTokProfilePicture(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const raw = data as Record<string, unknown>;
  const direct = cleanUrl(
    raw.profilePictureUrl || raw.avatarUrl || raw.avatar || raw.pfp
  );
  if (direct) return direct;

  const user = (raw.user || raw.userDetails || raw.author || raw.sender || raw) as Record<
    string,
    unknown
  >;
  const userDirect = cleanUrl(
    user?.profilePictureUrl || user?.avatarUrl || user?.avatar || user?.pfp
  );
  if (userDirect) return userDirect;

  const nestedLists = [
    (user?.profilePicture as { urls?: unknown[]; urlList?: unknown[]; mUrls?: unknown[] })
      ?.urls?.[0],
    (user?.profilePicture as { urls?: unknown[]; urlList?: unknown[]; mUrls?: unknown[] })
      ?.urlList?.[0],
    (user?.profilePicture as { urls?: unknown[]; urlList?: unknown[]; mUrls?: unknown[] })
      ?.mUrls?.[0],
    (user?.avatarThumb as { urls?: unknown[]; urlList?: unknown[]; mUrls?: unknown[] })
      ?.urls?.[0],
    (user?.avatarThumb as { urls?: unknown[]; urlList?: unknown[]; mUrls?: unknown[] })
      ?.urlList?.[0],
    (user?.avatarMedium as { urls?: unknown[]; urlList?: unknown[] })?.urls?.[0],
    (user?.avatarLarge as { urls?: unknown[]; urlList?: unknown[] })?.urls?.[0],
  ];

  for (const candidate of nestedLists) {
    const cleaned = cleanUrl(candidate);
    if (cleaned) return cleaned;
  }
  return '';
}

export function sanitizeTikTokUsername(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, '')
    .slice(0, 32);
}

export class TikTokRoomBridge {
  private callbacks: TikTokRoomBridgeCallbacks;
  private conn: TikTokLiveConnection | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private disposed = false;

  private status: TikTokStatus = {
    connected: false,
    mode: 'disconnected',
    username: null,
    roomId: null,
    viewerCount: 0,
    chatEventsProcessed: 0,
    guessesMatched: 0,
    likesCount: 0,
    giftsDiamonds: 0,
    lastError: null,
  };

  constructor(callbacks: TikTokRoomBridgeCallbacks) {
    this.callbacks = callbacks;
  }

  getStatus(): TikTokStatus {
    return { ...this.status };
  }

  incrementMatchedGuess(): void {
    this.status.guessesMatched += 1;
    this.callbacks.onStatusChange(this.getStatus());
  }

  async connect(
    rawUsername: string,
    isTestMode = false
  ): Promise<{ ok: boolean; status: TikTokStatus; error?: string }> {
    const clean = sanitizeTikTokUsername(rawUsername);
    if (!clean) {
      return {
        ok: false,
        status: this.getStatus(),
        error: 'Enter a valid TikTok @username (letters, numbers, underscores, or dots).',
      };
    }

    this.disconnect(false);
    this.disposed = false;
    this.reconnectAttempts = 0;

    if (isTestMode) {
      this.status = {
        connected: true,
        mode: 'test',
        username: clean,
        roomId: 'TEST_SIMULATION_ROOM',
        viewerCount: 1,
        chatEventsProcessed: 0,
        guessesMatched: 0,
        likesCount: 0,
        giftsDiamonds: 0,
        lastError: null,
      };
      this.callbacks.onStatusChange(this.getStatus());
      return { ok: true, status: this.getStatus() };
    }

    return this.connectLiveInternal(clean);
  }

  private async connectLiveInternal(
    cleanUsername: string
  ): Promise<{ ok: boolean; status: TikTokStatus; error?: string }> {
    try {
      const activeConn = new TikTokLiveConnection(cleanUsername, {
        processInitialData: false,
        enableExtendedGiftInfo: false,
      });
      this.conn = activeConn;

      activeConn.on(WebcastEvent.CHAT, (data: unknown) => {
        const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        const userObj = (raw.user || raw.userDetails || raw.author || raw.sender || {}) as Record<
          string,
          unknown
        >;
        const uniqueId = sanitizeTikTokUsername(
          userObj.uniqueId || raw.uniqueId || userObj.displayId || raw.userId || 'viewer'
        ) || 'viewer';
        const nickname = String(
          userObj.nickname || raw.nickname || raw.displayName || uniqueId || 'TikTok Viewer'
        )
          .trim()
          .slice(0, 32);
        const comment = String(raw.comment || raw.text || '').trim().slice(0, 160);
        if (!comment) return;

        this.status.chatEventsProcessed += 1;
        this.callbacks.onChat({
          uniqueId,
          nickname,
          profilePictureUrl: extractTikTokProfilePicture(raw),
          comment,
        });
      });

      activeConn.on(WebcastEvent.LIKE, (data: unknown) => {
        const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        const count = Number(raw.likeCount) || 1;
        this.status.likesCount += count;
        this.callbacks.onStatusChange(this.getStatus());
      });

      activeConn.on(WebcastEvent.GIFT, (data: unknown) => {
        const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        if (raw.giftType === 1 && !raw.repeatEnd) return;
        const diamonds = (Number(raw.diamondCount) || 1) * (Number(raw.repeatCount) || 1);
        this.status.giftsDiamonds += diamonds;
        this.callbacks.onStatusChange(this.getStatus());
      });

      activeConn.on(WebcastEvent.ROOM_USER, (data: unknown) => {
        const raw = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
        if (typeof raw.viewerCount === 'number') {
          this.status.viewerCount = raw.viewerCount;
          this.callbacks.onStatusChange(this.getStatus());
        }
      });

      activeConn.on(WebcastEvent.STREAM_END, () => {
        this.status.connected = false;
        this.status.mode = 'disconnected';
        this.status.lastError = `@${cleanUsername}'s TikTok LIVE stream ended.`;
        this.callbacks.onStatusChange(this.getStatus());
      });

      activeConn.on(ControlEvent.DISCONNECTED, () => {
        if (this.disposed || this.conn !== activeConn) return;
        this.status.connected = false;
        this.callbacks.onStatusChange(this.getStatus());
        this.scheduleReconnect(cleanUsername);
      });

      const state = await activeConn.connect();
      if (this.disposed || this.conn !== activeConn) {
        try {
          activeConn.disconnect();
        } catch {
          // ignore
        }
        return { ok: false, status: this.getStatus(), error: 'Connection superseded.' };
      }

      this.reconnectAttempts = 0;
      const roomInfo = (state as { roomId?: string; roomInfo?: { user_count?: number } } | null);
      this.status = {
        ...this.status,
        connected: true,
        mode: 'live',
        username: cleanUsername,
        roomId: roomInfo?.roomId ? String(roomInfo.roomId) : `LIVE_${cleanUsername}`,
        viewerCount: Number(roomInfo?.roomInfo?.user_count) || 1,
        lastError: null,
      };
      this.callbacks.onStatusChange(this.getStatus());
      return { ok: true, status: this.getStatus() };
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error ? err.message : 'Unable to connect to TikTok LIVE.';
      const friendly = rawMessage.toLowerCase().includes('offline')
        ? `@${cleanUsername} is currently offline on TikTok LIVE. Switch to Test Simulator to test chat answers now.`
        : `Could not connect to @${cleanUsername}: ${rawMessage}`;
      this.status = {
        ...this.status,
        connected: false,
        mode: 'disconnected',
        username: cleanUsername,
        roomId: null,
        lastError: friendly,
      };
      this.callbacks.onStatusChange(this.getStatus());
      return { ok: false, status: this.getStatus(), error: friendly };
    }
  }

  private scheduleReconnect(cleanUsername: string): void {
    if (this.disposed || this.reconnectAttempts >= 3) return;
    this.reconnectAttempts += 1;
    const delayMs = this.reconnectAttempts * 3000;
    this.reconnectTimer = setTimeout(() => {
      if (this.disposed) return;
      void this.connectLiveInternal(cleanUsername);
    }, delayMs);
  }

  injectChat(input: {
    uniqueId?: string;
    nickname?: string;
    profilePictureUrl?: string;
    comment: string;
  }): void {
    const comment = String(input.comment || '').trim().slice(0, 160);
    if (!comment) return;
    const uniqueId =
      sanitizeTikTokUsername(input.uniqueId || input.nickname || 'tiktok_viewer') ||
      'tiktok_viewer';
    const nickname = String(input.nickname || uniqueId).trim().slice(0, 32);
    this.status.chatEventsProcessed += 1;
    this.callbacks.onChat({
      uniqueId,
      nickname,
      profilePictureUrl: cleanUrl(input.profilePictureUrl),
      comment,
    });
  }

  disconnect(notify = true): void {
    this.disposed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.conn) {
      try {
        this.conn.disconnect();
      } catch {
        // ignore
      }
      this.conn = null;
    }
    this.status = {
      connected: false,
      mode: 'disconnected',
      username: null,
      roomId: null,
      viewerCount: 0,
      chatEventsProcessed: 0,
      guessesMatched: 0,
      likesCount: 0,
      giftsDiamonds: 0,
      lastError: null,
    };
    if (notify) {
      this.callbacks.onStatusChange(this.getStatus());
    }
  }
}
