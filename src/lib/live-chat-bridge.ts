import { io, Socket } from "socket.io-client";
import { getLiveConnectionSessionId } from "./unified-game-auth";
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
  reconnecting?: boolean;
  username?: string;
  roomId?: string;
  gameId?: string;
  error?: string;
  notice?: string;
}

export interface EventDeduplicator {
  shouldProcess: (type: "chat" | "like" | "gift", payload: any) => boolean;
}

export function createEventDeduplicator(): EventDeduplicator {
  const seenKeys = new Set<string>();
  return {
    shouldProcess(type, payload) {
      if (!payload) return false;
      const keysToCheck: string[] = [];
      if (typeof payload._seq === "number") {
        keysToCheck.push(`${type}:seq:${payload._seq}`);
      }
      const rawId = payload.id || payload.eventId || payload.msgId;
      if (rawId) {
        keysToCheck.push(`${type}:id:${rawId}`);
      }
      if (keysToCheck.length === 0) return true;
      if (keysToCheck.some((k) => seenKeys.has(k))) return false;
      keysToCheck.forEach((k) => seenKeys.add(k));
      if (seenKeys.size > 600) {
        const oldest = Array.from(seenKeys).slice(0, 250);
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
  const nested = raw.user || raw.userDetails || raw.author || raw.sender || {};
  const candidateNick = String(
    raw.nickname ||
      raw.displayName ||
      nested.nickname ||
      nested.displayName ||
      nested.name ||
      "",
  )
    .trim()
    .replace(/^@+/, "");
  const idCandidates = [
    raw.uniqueId,
    raw.username,
    raw.userId,
    nested.uniqueId,
    nested.displayId,
    nested.username,
    nested.userId,
    nested.id,
  ]
    .map((v) => String(v || "").trim().replace(/^@+/, ""))
    .filter(Boolean);
  const candidateId =
    idCandidates.find((v) => v.toLowerCase() !== "viewer") || idCandidates[0] || "";
  const uniqueId =
    candidateId && candidateId.toLowerCase() !== "viewer"
      ? candidateId
      : candidateNick && candidateNick.toLowerCase() !== "viewer"
        ? candidateNick
        : candidateId || "viewer";
  const nickname = candidateNick || uniqueId || "Viewer";
  const comment = String(raw.comment ?? raw.text ?? "").trim();
  const rawAvatar = String(
    raw.profilePictureUrl || raw.avatar || nested.profilePictureUrl || nested.avatar || "",
  ).trim();
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
    forceReconnect?: boolean;
  },
  onConnected?: (info: { username: string; roomId?: string }) => void,
) {
  const clean = String(options.username || "")
    .trim()
    .replace(/^@+/, "");
  const gameId = options.gameId;
  const sessionId = options.sessionId || getLiveConnectionSessionId();
  const isTestMode = Boolean(options.isTestMode);
  if (!clean) return;

  if (gameId) {
    liveChatBridge.setActiveGame(gameId);
  }

  if (socket) {
    socket.emit("connect-tiktok", {
      username: clean,
      sessionId,
      gameId,
      isTestMode,
      provider: options.provider,
      forceReconnect: Boolean(options.forceReconnect),
    });
  }

  void liveChatBridge
    .connectStream(clean, gameId, {
      sessionId,
      isTestMode,
      provider: options.provider,
      forceReconnect: Boolean(options.forceReconnect),
    })
    .then((res) => {
      if (onConnected) {
        onConnected({
          username: res.username || clean,
          roomId:
            res.roomId || (isTestMode ? "TEST_SIMULATION_ROOM" : `LIVE_${clean}`),
        });
      }
    });
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
  triggerResilientConnect(
    socket,
    { ...options, forceReconnect: true },
    onConnected,
  );
}

export function emitResilientEvent(
  socket: Socket | null | undefined,
  type: "chat-message" | "like-event" | "gift-event",
  payload: Record<string, unknown>,
) {
  const gameId = typeof payload?.gameId === "string" ? payload.gameId : undefined;
  const sessionId =
    typeof payload?.sessionId === "string" && payload.sessionId.trim()
      ? payload.sessionId.trim()
      : getLiveConnectionSessionId();
  if (typeof window !== "undefined") {
    fetch("/api/tiktok/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, gameId, type, payload }),
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
  gameId?: string;
  onChat?: (data: any) => void;
  onLike?: (data: any) => void;
  onGift?: (data: any) => void;
  onStatus?: (status: LiveStatusEvent) => void;
  deduplicator?: EventDeduplicator;
}): () => void {
  if (params.gameId) {
    liveChatBridge.setActiveGame(params.gameId);
  }
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
  if (params.onStatus) {
    unsubs.push(
      liveChatBridge.onStatus((status) => {
        if (!params.gameId || !status.gameId || status.gameId === params.gameId) {
          params.onStatus?.(status);
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
  private pollInFlight = false;
  private httpCooldownUntil = 0;
  private httpBackoffMs = 0;
  private lastPollAt = 0;
  private lastSeq = 0;
  private seenSeqs = new Set<number>();

  private statusListeners = new Set<Listener<LiveStatusEvent>>();
  private chatListeners = new Set<Listener<LiveChatCommentEvent>>();
  private likeListeners = new Set<Listener<LiveLikeEvent>>();
  private giftListeners = new Set<Listener<LiveGiftEvent>>();

  private currentStatus: LiveStatusEvent = { connected: false };
  private initialized = false;
  private sessionId = "isolated_default";
  private activeGameId: string | undefined = undefined;
  private activeUsername = "";
  private activeIsTestMode = false;
  private activeProvider: string | undefined = undefined;
  private explicitlyDisconnected = false;
  private hasConnectedOnce = false;
  private lastKeepaliveAt = 0;

  private isOverlayRoute(): boolean {
    if (typeof window === "undefined") return false;
    const cleanPath = window.location.pathname.toLowerCase().replace(/\/+$/, "");
    const params = new URLSearchParams(window.location.search);
    return (
      cleanPath.endsWith("/overlay") ||
      params.get("overlay") === "1" ||
      params.get("clean") === "1"
    );
  }

  public getSessionId(): string {
    const nextId = getLiveConnectionSessionId();
    if (nextId !== this.sessionId) {
      this.sessionId = nextId;
      this.syncSocketMembership();
    }
    return this.sessionId;
  }

  public setActiveGame(gameId?: string): void {
    const clean = gameId ? String(gameId).trim().toLowerCase() : undefined;
    if (clean === this.activeGameId) return;
    this.activeGameId = clean;
    this.lastSeq = 0;
    this.seenSeqs.clear();
    this.currentStatus = { connected: false, gameId: clean };
    this.syncSocketMembership();
  }

  private syncSocketMembership(): void {
    if (this.socket && this.socket.connected) {
      this.socket.emit("join-session", {
        sessionId: this.sessionId,
        gameId: this.activeGameId,
      });
    }
  }

  private sendKeepaliveAndRecover(): void {
    if (this.explicitlyDisconnected || !this.activeUsername) return;
    touchActiveInteractiveStreamerSession();
    this.lastKeepaliveAt = Date.now();
    if (this.socket && this.socket.connected) {
      this.socket.emit("tiktok-keepalive", {
        sessionId: this.getSessionId(),
        gameId: this.activeGameId,
        username: this.activeUsername,
        isTestMode: this.activeIsTestMode,
        provider: this.activeProvider,
      });
    }
  }

  public init() {
    if (this.initialized || typeof window === "undefined") return;
    if (this.isOverlayRoute()) return;
    this.initialized = true;
    this.sessionId = getLiveConnectionSessionId();

    try {
      this.socket = io(window.location.origin, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 10000,
        randomizationFactor: 0.4,
        timeout: 15000,
        query: {
          sessionId: this.sessionId,
          ...(this.activeGameId ? { gameId: this.activeGameId } : {}),
        },
      });

      this.socket.on("connect", () => {
        const wasReconnect = this.hasConnectedOnce;
        this.hasConnectedOnce = true;
        this.getSessionId();
        this.syncSocketMembership();
        // Auto-recover active TikTok LIVE stream transparently after any network drop or server restart
        if (wasReconnect && !this.explicitlyDisconnected && this.activeUsername) {
          this.sendKeepaliveAndRecover();
          void this.connectStream(this.activeUsername, this.activeGameId, {
            sessionId: this.getSessionId(),
            isTestMode: this.activeIsTestMode,
            provider: this.activeProvider,
            forceReconnect: false,
          });
        }
      });

      this.socket.on("disconnect", (reason) => {
        if (!this.explicitlyDisconnected && this.activeUsername && reason !== "io client disconnect") {
          this.updateStatus({
            ...this.currentStatus,
            connected: true,
            reconnecting: true,
            username: this.activeUsername,
            gameId: this.activeGameId,
            notice: "Connection dropped — auto-reconnecting…",
          });
        }
      });

      this.socket.on("tiktok-status", (status: LiveStatusEvent) => {
        if (this.activeGameId && status?.gameId && status.gameId !== this.activeGameId) {
          return;
        }
        if (status.connected && status.username) {
          this.activeUsername = status.username;
          this.explicitlyDisconnected = false;
        }
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

      // Automatically wake socket & recover stream when network returns or tab comes back into focus
      const handleNetworkOrWake = () => {
        if (this.socket && this.socket.disconnected && !this.socket.active) {
          this.socket.connect();
        }
        if (!this.explicitlyDisconnected && this.activeUsername) {
          this.sendKeepaliveAndRecover();
        }
      };
      window.addEventListener("online", handleNetworkOrWake);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) handleNetworkOrWake();
      });
    } catch {
      // Fallback to HTTP polling
    }

    // Gentle fallback poll + 45s keepalive heartbeat to prevent idle drops
    this.pollTimer = setInterval(() => {
      const now = Date.now();
      const socketUp = Boolean(this.socket?.connected);
      if (this.socket && this.socket.disconnected && !this.socket.active) {
        this.socket.connect();
      }
      if (!this.explicitlyDisconnected && this.activeUsername && now - this.lastKeepaliveAt >= 45_000) {
        this.sendKeepaliveAndRecover();
      }
      const minInterval = socketUp
        ? 12000
        : this.currentStatus.connected
          ? 4000
          : 15000;
      if (now - this.lastPollAt >= minInterval) {
        void this.pollEvents();
      }
    }, 2000);
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
    const now = Date.now();
    if (this.pollInFlight || now < this.httpCooldownUntil) return;
    if (typeof document !== "undefined" && document.hidden && !this.currentStatus.connected) {
      return;
    }
    this.pollInFlight = true;
    this.lastPollAt = now;
    try {
      const sid = encodeURIComponent(this.getSessionId());
      const gidParam = this.activeGameId
        ? `&gameId=${encodeURIComponent(this.activeGameId)}`
        : "";
      const res = await fetch(
        `/api/tiktok/events?sessionId=${sid}${gidParam}&since=${this.lastSeq}`,
      );
      if (!res.ok) {
        if (
          res.status === 401 ||
          res.status === 403 ||
          res.status === 426 ||
          res.status === 429 ||
          res.status >= 500
        ) {
          this.httpBackoffMs =
            this.httpBackoffMs > 0 ? Math.min(120000, this.httpBackoffMs * 2) : 20000;
          this.httpCooldownUntil = Date.now() + this.httpBackoffMs;
        }
        return;
      }
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        this.httpBackoffMs =
          this.httpBackoffMs > 0 ? Math.min(120000, this.httpBackoffMs * 2) : 20000;
        this.httpCooldownUntil = Date.now() + this.httpBackoffMs;
        return;
      }
      this.httpBackoffMs = 0;
      this.httpCooldownUntil = 0;
      const data = await res.json();

      if (
        typeof data.connected === "boolean" &&
        data.connected &&
        (data.connected !== this.currentStatus.connected ||
          data.username !== this.currentStatus.username)
      ) {
        this.updateStatus({
          connected: data.connected,
          username: data.username,
          roomId: data.roomId,
          gameId: this.activeGameId,
        });
      }

      if (Array.isArray(data.events)) {
        for (const item of data.events) {
          const itemSeq =
            typeof item.seq === "number"
              ? item.seq
              : typeof item.payload?._seq === "number"
                ? item.payload._seq
                : undefined;
          if (!this.shouldProcess(itemSeq)) continue;
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
    } finally {
      this.pollInFlight = false;
    }
  }

  public async connectStream(
    username: string,
    gameId?: string,
    extraOptions?: {
      sessionId?: string;
      isTestMode?: boolean;
      provider?: string;
      forceReconnect?: boolean;
    },
  ): Promise<LiveStatusEvent> {
    this.init();
    if (gameId) {
      this.setActiveGame(gameId);
    }
    const clean = username.trim().replace(/^@+/, "");
    if (!clean) {
      const errStatus = { connected: false, error: "Enter a TikTok @username" };
      this.updateStatus(errStatus);
      return errStatus;
    }

    this.explicitlyDisconnected = false;
    this.activeUsername = clean;
    this.activeIsTestMode = Boolean(extraOptions?.isTestMode);
    this.activeProvider = extraOptions?.provider;
    this.lastKeepaliveAt = Date.now();

    const sessionId = extraOptions?.sessionId || this.getSessionId();
    if (this.socket && this.socket.disconnected && !this.socket.active) {
      this.socket.connect();
    }
    if (this.socket && this.socket.connected) {
      this.socket.emit("join-session", {
        sessionId,
        gameId: gameId || this.activeGameId,
      });
    }

    try {
      const res = await fetch("/api/tiktok/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: clean,
          sessionId,
          gameId,
          isTestMode: Boolean(extraOptions?.isTestMode),
          provider: extraOptions?.provider,
          forceReconnect: Boolean(extraOptions?.forceReconnect),
        }),
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = (await res.json()) as LiveStatusEvent;
        this.updateStatus(data);
        return data;
      }
    } catch {
      // Fallback to socket or local relay status
    }

    const fallbackStatus: LiveStatusEvent = {
      connected: true,
      username: clean,
      roomId: `LIVE_${clean}`,
      gameId,
    };
    this.updateStatus(fallbackStatus);
    return fallbackStatus;
  }

  public async disconnectStream(gameId?: string, explicitSessionId?: string): Promise<void> {
    this.init();
    this.explicitlyDisconnected = true;
    this.activeUsername = "";
    const sessionId = explicitSessionId || this.getSessionId();
    try {
      await fetch("/api/tiktok/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, gameId: gameId || this.activeGameId }),
      });
    } catch {
      this.socket?.emit("disconnect-tiktok", {
        sessionId,
        gameId: gameId || this.activeGameId,
      });
    }
    this.updateStatus({ connected: false, gameId: gameId || this.activeGameId });
  }

  public async reconnectNow(gameId?: string): Promise<LiveStatusEvent | null> {
    if (!this.activeUsername) return null;
    if (this.socket && this.socket.disconnected) {
      this.socket.connect();
    }
    return this.connectStream(this.activeUsername, gameId || this.activeGameId, {
      sessionId: this.getSessionId(),
      isTestMode: this.activeIsTestMode,
      provider: this.activeProvider,
      forceReconnect: true,
    });
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
