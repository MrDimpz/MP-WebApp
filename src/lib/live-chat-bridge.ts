import { io, Socket } from "socket.io-client";
import { getCurrentUserSessionPrefix } from "./unified-game-auth";
import { touchActiveInteractiveStreamerSession } from "./interactive-key-auth";

export interface LiveChatCommentEvent {
  id: string;
  userId: string;
  uniqueId: string;
  username: string;
  nickname: string;
  comment: string;
  avatar: string;
  profilePictureUrl?: string;
  timestamp: number;
  _seq?: number;
}

export interface LiveLikeEvent {
  userId: string;
  uniqueId: string;
  username: string;
  nickname: string;
  avatar: string;
  profilePictureUrl?: string;
  likeCount: number;
  totalLikeCount: number;
  _seq?: number;
}

export interface LiveGiftEvent {
  userId: string;
  uniqueId: string;
  username: string;
  nickname: string;
  avatar: string;
  profilePictureUrl?: string;
  giftName: string;
  giftId: number;
  repeatCount: number;
  diamondCount: number;
  repeatEnd?: boolean;
  _seq?: number;
}

export interface LiveStatusEvent {
  connected: boolean;
  username?: string;
  error?: string;
}

export interface EventDeduplicator {
  shouldProcess: (type: "chat" | "like" | "gift", payload: any) => boolean;
}

export function createEventDeduplicator(): EventDeduplicator {
  const seenKeys = new Set<string>();
  return {
    shouldProcess(type, payload) {
      if (!payload) return false;
      const seqKey =
        typeof payload._seq === "number"
          ? `${type}:seq:${payload._seq}`
          : payload.id || payload.eventId
            ? `${type}:id:${payload.id || payload.eventId}`
            : null;
      if (!seqKey) return true;
      if (seenKeys.has(seqKey)) return false;
      seenKeys.add(seqKey);
      if (seenKeys.size > 500) {
        const oldest = Array.from(seenKeys).slice(0, 200);
        oldest.forEach((k) => seenKeys.delete(k));
      }
      return true;
    },
  };
}

export function normalizeIncomingChatPayload(raw: any): {
  id: string;
  uniqueId: string;
  nickname: string;
  comment: string;
  profilePictureUrl: string;
  timestamp: number;
  _seq?: number;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const uniqueId = String(
    raw.uniqueId || raw.username || raw.userId || "viewer",
  )
    .trim()
    .replace(/^@+/, "");
  const nickname = String(raw.nickname || uniqueId || "Viewer")
    .trim()
    .replace(/^@+/, "");
  const comment = String(raw.comment ?? raw.text ?? "").trim();
  const rawAvatar = String(raw.profilePictureUrl || raw.avatar || "").trim();
  const profilePictureUrl = rawAvatar.startsWith("//")
    ? `https:${rawAvatar}`
    : rawAvatar.startsWith("http")
      ? rawAvatar
      : `https://i.pravatar.cc/150?u=${encodeURIComponent(uniqueId || nickname)}`;
  return {
    id: String(
      raw.id ||
        raw.msgId ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ),
    uniqueId,
    nickname,
    comment,
    profilePictureUrl,
    timestamp: Number(raw.timestamp) || Date.now(),
    _seq: typeof raw._seq === "number" ? raw._seq : undefined,
  };
}

export function triggerResilientConnect(
  socket: Socket | null | undefined,
  options: {
    username: string;
    isTestMode?: boolean;
    provider?: string;
    key?: string;
    sessionId?: string;
    gameId?: string;
  },
  onConnected?: (info: { username: string; roomId?: string }) => void,
) {
  const clean = String(options.username || "")
    .trim()
    .replace(/^@+/, "");
  const sessionId = options.sessionId || getCurrentUserSessionPrefix();
  const gameId = options.gameId;
  if (!clean) return;

  if (socket) {
    socket.emit("join-session", sessionId);
    if (!options.isTestMode) {
      socket.emit("connect-tiktok", {
        username: clean,
        sessionId,
        gameId,
      });
    }
  }

  if (!options.isTestMode) {
    void liveChatBridge.connectStream(clean, gameId).then((res) => {
      if (res.connected && onConnected) {
        onConnected({ username: res.username || clean, roomId: `session:${sessionId}` });
      }
    });
  } else if (onConnected) {
    onConnected({ username: clean, roomId: "TEST_SIMULATION_ROOM" });
  }
}

export function forceReconnectBridge(
  socket: Socket | null | undefined,
  options: {
    username: string;
    isTestMode?: boolean;
    provider?: string;
    key?: string;
    sessionId?: string;
    gameId?: string;
  },
  onConnected?: (info: { username: string; roomId?: string }) => void,
) {
  triggerResilientConnect(socket, options, onConnected);
}

export function emitResilientEvent(
  socket: Socket | null | undefined,
  type: "chat-message" | "like-event" | "gift-event",
  payload: Record<string, unknown>,
) {
  const sessionId = getCurrentUserSessionPrefix();
  if (typeof window !== "undefined") {
    fetch("/api/tiktok/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, type, payload }),
    }).catch(() => {
      if (socket) {
        socket.emit(type, payload);
      }
    });
  } else if (socket) {
    socket.emit(type, payload);
  }
}

export function attachResilientChatListeners(params: {
  onChat?: (data: any) => void;
  onLike?: (data: any) => void;
  onGift?: (data: any) => void;
  deduplicator?: EventDeduplicator;
}): () => void {
  const dedup = params.deduplicator || createEventDeduplicator();
  const unsubs: Array<() => void> = [];

  if (params.onChat) {
    unsubs.push(
      liveChatBridge.onChat((ev) => {
        const normalized = normalizeIncomingChatPayload(ev) || ev;
        if (dedup.shouldProcess("chat", normalized)) {
          params.onChat?.(normalized);
        }
      }),
    );
  }
  if (params.onLike) {
    unsubs.push(
      liveChatBridge.onLike((ev) => {
        if (dedup.shouldProcess("like", ev)) {
          params.onLike?.(ev);
        }
      }),
    );
  }
  if (params.onGift) {
    unsubs.push(
      liveChatBridge.onGift((ev) => {
        if (dedup.shouldProcess("gift", ev)) {
          params.onGift?.(ev);
        }
      }),
    );
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

type Listener<T> = (payload: T) => void;

class LiveChatBridge {
  private socket: Socket | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastSeq = 0;
  private seenSeqs = new Set<number>();

  private statusListeners = new Set<Listener<LiveStatusEvent>>();
  private chatListeners = new Set<Listener<LiveChatCommentEvent>>();
  private likeListeners = new Set<Listener<LiveLikeEvent>>();
  private giftListeners = new Set<Listener<LiveGiftEvent>>();

  private currentStatus: LiveStatusEvent = { connected: false };
  private initialized = false;
  private sessionId = "isolated_default";

  private getSessionId(): string {
    const nextId = getCurrentUserSessionPrefix();
    if (nextId !== this.sessionId) {
      this.sessionId = nextId;
      if (this.socket && this.socket.connected) {
        this.socket.emit("join-session", this.sessionId);
      }
    }
    return this.sessionId;
  }

  public init() {
    if (this.initialized || typeof window === "undefined") return;
    this.initialized = true;
    this.sessionId = getCurrentUserSessionPrefix();

    try {
      this.socket = io(window.location.origin, {
        path: "/socket.io",
        transports: ["polling", "websocket"],
        reconnectionAttempts: 5,
        query: {
          sessionId: this.sessionId,
        },
      });

      this.socket.on("connect", () => {
        this.socket?.emit("join-session", this.getSessionId());
      });

      this.socket.on("tiktok-status", (status: LiveStatusEvent) => {
        this.updateStatus(status);
      });

      this.socket.on("chat-message", (data: LiveChatCommentEvent) => {
        touchActiveInteractiveStreamerSession();
        if (this.shouldProcess(data._seq)) {
          this.chatListeners.forEach((cb) => cb(data));
        }
      });

      this.socket.on("like-event", (data: LiveLikeEvent) => {
        if (this.shouldProcess(data._seq)) {
          this.likeListeners.forEach((cb) => cb(data));
        }
      });

      this.socket.on("gift-event", (data: LiveGiftEvent) => {
        if (this.shouldProcess(data._seq)) {
          this.giftListeners.forEach((cb) => cb(data));
        }
      });
    } catch {
      // Fallback to HTTP polling
    }

    this.pollTimer = setInterval(() => {
      void this.pollEvents();
    }, 1500);
  }

  private shouldProcess(seq?: number): boolean {
    if (typeof seq !== "number") return true;
    if (this.seenSeqs.has(seq)) return false;
    this.seenSeqs.add(seq);
    if (seq > this.lastSeq) {
      this.lastSeq = seq;
    }
    if (this.seenSeqs.size > 400) {
      const oldest = Array.from(this.seenSeqs).slice(0, 150);
      oldest.forEach((s) => this.seenSeqs.delete(s));
    }
    return true;
  }

  private updateStatus(status: LiveStatusEvent) {
    this.currentStatus = status;
    this.statusListeners.forEach((cb) => cb(status));
  }

  private async pollEvents() {
    try {
      const sid = encodeURIComponent(this.getSessionId());
      const res = await fetch(
        `/api/tiktok/events?sessionId=${sid}&since=${this.lastSeq}`,
      );
      if (!res.ok) return;
      const data = await res.json();

      if (
        typeof data.connected === "boolean" &&
        (data.connected !== this.currentStatus.connected ||
          data.username !== this.currentStatus.username)
      ) {
        this.updateStatus({
          connected: data.connected,
          username: data.username,
        });
      }

      if (Array.isArray(data.events)) {
        for (const item of data.events) {
          if (!this.shouldProcess(item.seq)) continue;
          if (item.type === "chat-message") {
            touchActiveInteractiveStreamerSession();
            this.chatListeners.forEach((cb) =>
              cb(item.payload as LiveChatCommentEvent),
            );
          } else if (item.type === "like-event") {
            this.likeListeners.forEach((cb) =>
              cb(item.payload as LiveLikeEvent),
            );
          } else if (item.type === "gift-event") {
            this.giftListeners.forEach((cb) =>
              cb(item.payload as LiveGiftEvent),
            );
          }
        }
      }
    } catch {
      // Ignore network polling errors
    }
  }

  public async connectStream(username: string, gameId?: string): Promise<LiveStatusEvent> {
    this.init();
    const clean = username.trim().replace(/^@/, "");
    if (!clean) {
      const errStatus = { connected: false, error: "Enter a TikTok @username" };
      this.updateStatus(errStatus);
      return errStatus;
    }

    const sessionId = this.getSessionId();

    try {
      const res = await fetch("/api/tiktok/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: clean, sessionId, gameId }),
      });
      const data = (await res.json()) as LiveStatusEvent;
      this.updateStatus(data);
      return data;
    } catch {
      if (this.socket) {
        this.socket.emit("join-session", sessionId);
        this.socket.emit("connect-tiktok", { username: clean, sessionId, gameId });
      }
      return this.currentStatus;
    }
  }

  public async disconnectStream(gameId?: string): Promise<void> {
    this.init();
    const sessionId = this.getSessionId();
    try {
      await fetch("/api/tiktok/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, gameId }),
      });
    } catch {
      this.socket?.emit("disconnect-tiktok", { sessionId, gameId });
    }
    this.updateStatus({ connected: false });
  }

  public onStatus(cb: Listener<LiveStatusEvent>): () => void {
    this.init();
    this.statusListeners.add(cb);
    cb(this.currentStatus);
    return () => this.statusListeners.delete(cb);
  }

  public onChat(cb: Listener<LiveChatCommentEvent>): () => void {
    this.init();
    this.chatListeners.add(cb);
    return () => this.chatListeners.delete(cb);
  }

  public onLike(cb: Listener<LiveLikeEvent>): () => void {
    this.init();
    this.likeListeners.add(cb);
    return () => this.likeListeners.delete(cb);
  }

  public onGift(cb: Listener<LiveGiftEvent>): () => void {
    this.init();
    this.giftListeners.add(cb);
    return () => this.giftListeners.delete(cb);
  }

  public emitSimulatedChat(username: string, comment: string) {
    const clean = username.trim().replace(/^@/, "") || "viewer";
    const event: LiveChatCommentEvent = {
      id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: clean.toLowerCase(),
      uniqueId: clean.toLowerCase(),
      username: clean,
      nickname: clean,
      comment,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(clean)}`,
      profilePictureUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(clean)}`,
      timestamp: Date.now(),
    };
    this.chatListeners.forEach((cb) => cb(event));
  }
}

export const liveChatBridge = new LiveChatBridge();
