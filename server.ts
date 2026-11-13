import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  TikTokLiveConnection,
  WebcastEvent,
  ControlEvent,
} from "tiktok-live-connector";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Export WebcastPushConnection alias for compatibility
export const WebcastPushConnection = TikTokLiveConnection;

function cleanUrl(val: unknown): string {
  if (!val || typeof val !== "string") return "";
  const s = val.trim();
  if (!s || s === "undefined" || s === "null") return "";
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return "";
}

function extractProfilePicture(data: any): string {
  if (!data || typeof data !== "object") return "";
  const directPfp = cleanUrl(
    data.profilePictureUrl || data.avatarUrl || data.avatar || data.pfp,
  );
  if (directPfp) return directPfp;

  const user =
    data.user || data.userDetails || data.author || data.sender || data;
  const userPfp = cleanUrl(
    user?.profilePictureUrl || user?.avatarUrl || user?.avatar || user?.pfp,
  );
  if (userPfp) return userPfp;

  const candidates = [
    user?.profilePicture?.urls?.[0],
    user?.profilePicture?.urlList?.[0],
    user?.profilePicture?.mUrls?.[0],
    user?.profile_picture?.urls?.[0],
    user?.profile_picture?.url_list?.[0],
    user?.avatarThumb?.urls?.[0],
    user?.avatarThumb?.urlList?.[0],
    user?.avatarThumb?.mUrls?.[0],
    user?.avatarMedium?.urls?.[0],
    user?.avatarMedium?.urlList?.[0],
    user?.avatarLarge?.urls?.[0],
    user?.avatarLarge?.urlList?.[0],
    user?.profilePictureUrlList?.[0],
  ];
  for (const url of candidates) {
    const cleaned = cleanUrl(url);
    if (cleaned) return cleaned;
  }
  return "";
}

// Persistent storage helper for authorized streamer keys on the server
const DATA_DIR = path.join(__dirname, ".relay_data");
const STREAMERS_FILE = path.join(DATA_DIR, "authorized_streamers.json");

const DEFAULT_SERVER_STREAMERS = [
  {
    id: "user-mrdimpz",
    username: "mrdimpz",
    displayHandle: "@mrdimpz",
    key: "LIVE-DIMP-2026",
    label: "The Missing Piece Official",
    createdAt: 1730000000000,
    createdBy: "MPAdmin",
  },
  {
    id: "user-mindtipgames",
    username: "mindtipgames",
    displayHandle: "@mindtipgames",
    key: "LIVE-MIND-2026",
    label: "MindTipGames Live Host",
    createdAt: 1730000000000,
    createdBy: "MPAdmin",
  },
];

function loadServerStreamers() {
  try {
    if (fs.existsSync(STREAMERS_FILE)) {
      const raw = fs.readFileSync(STREAMERS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore read error
  }
  return [...DEFAULT_SERVER_STREAMERS];
}

function saveServerStreamers(list: any[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STREAMERS_FILE, JSON.stringify(list, null, 2), "utf8");
  } catch {
    // ignore write error on read-only fs
  }
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: "*", methods: ["GET", "POST", "OPTIONS"] },
    transports: ["polling", "websocket"],
    allowEIO3: true,
    pingTimeout: 25000,
    pingInterval: 20000,
  });

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With",
    );
    if (req.method === "OPTIONS") {
      res.status(200).json({ ok: true });
      return;
    }
    next();
  });

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  const sessions = new Map();
  let globalWebhookCount = 0;
  let lastWebhookTime = 0;
  let lastWebhookProvider = "";

  function normalizeSessionKey(rawSessionId: unknown): string {
    if (typeof rawSessionId === "string" && rawSessionId.trim()) {
      return rawSessionId.trim();
    }
    return "default_isolated_session";
  }

  function getOrCreateSession(rawSessionId: unknown): any {
    const sessionId = normalizeSessionKey(rawSessionId);
    let state = sessions.get(sessionId);
    if (!state) {
      state = {
        sessionId,
        tiktokConn: null,
        connectingPromise: null,
        retryTimer: null,
        connectedUsername: null,
        connectedRoomId: null,
        isTestMode: false,
        provider: "tikfinity",
        connectedGames: new Set(),
        eventSeq: 0,
        recentEvents: [],
        lastActiveAt: Date.now(),
      };
      sessions.set(sessionId, state);
    }
    state.lastActiveAt = Date.now();
    return state;
  }

  function clearSessionRetryTimer(session: any) {
    if (session.retryTimer) {
      clearTimeout(session.retryTimer);
      session.retryTimer = null;
    }
  }

  function closeSessionTikTokConnOnly(session: any) {
    clearSessionRetryTimer(session);
    if (session.tiktokConn) {
      try {
        session.tiktokConn.disconnect();
      } catch {
        // Ignore disconnect error
      }
      session.tiktokConn = null;
    }
  }

  function disconnectSessionTikTok(session: any) {
    closeSessionTikTokConnOnly(session);
    session.connectingPromise = null;
    session.connectedUsername = null;
    session.connectedRoomId = null;
    session.isTestMode = false;
    session.connectedGames.clear();
  }

  function pushAndEmitToSession(session: any, type: string, payload: any) {
    session.eventSeq += 1;
    session.lastActiveAt = Date.now();
    const enriched = {
      ...payload,
      _seq: session.eventSeq,
      timestamp: Number(payload?.timestamp) || Date.now(),
    };
    session.recentEvents.push({
      seq: session.eventSeq,
      timestamp: enriched.timestamp,
      type,
      payload: enriched,
    });
    if (session.recentEvents.length > 250) {
      session.recentEvents.splice(0, session.recentEvents.length - 250);
    }
    io.to(`session:${session.sessionId}`).emit(type, enriched);
    if (session.connectedUsername) {
      io.to(`streamer:${session.connectedUsername.toLowerCase()}`).emit(
        type,
        enriched,
      );
    }
  }

  function emitConnectedState(session: any, gameId?: string) {
    const cleanUsername = session.connectedUsername || "streamer";
    const roomId = session.connectedRoomId || `LIVE_${cleanUsername}`;
    const connPayload = {
      username: cleanUsername,
      roomId,
      gameId,
      isTestMode: Boolean(session.isTestMode),
      provider: session.provider || "tikfinity",
    };
    const statusPayload = {
      connected: true,
      username: cleanUsername,
      roomId,
      gameId,
      isTestMode: Boolean(session.isTestMode),
      provider: session.provider || "tikfinity",
    };

    io.to(`session:${session.sessionId}`).emit("tiktok-connected", connPayload);
    io.to(`session:${session.sessionId}`).emit("tiktok-status", statusPayload);
    if (cleanUsername) {
      io.to(`streamer:${cleanUsername.toLowerCase()}`).emit(
        "tiktok-connected",
        connPayload,
      );
      io.to(`streamer:${cleanUsername.toLowerCase()}`).emit(
        "tiktok-status",
        statusPayload,
      );
    }
    io.emit("tiktok-connected", connPayload);
    io.emit("tiktok-status", statusPayload);
  }

  function attachTikTokConnListeners(
    session: any,
    activeConn: any,
    cleanUsername: string,
  ) {
    activeConn.on(WebcastEvent.CHAT, (data: any) => {
      const uniqueId = String(
        data?.user?.uniqueId || data?.uniqueId || data?.userId || "viewer",
      )
        .trim()
        .replace(/^@+/, "");
      const nickname = String(
        data?.user?.nickname || data?.nickname || uniqueId || "Viewer",
      )
        .trim()
        .replace(/^@+/, "");
      const comment = String(data?.comment || data?.content || "").trim();
      if (!comment) return;

      const profilePictureUrl =
        extractProfilePicture(data) ||
        `https://i.pravatar.cc/150?u=${encodeURIComponent(uniqueId || nickname)}`;

      const chatPayload = {
        id:
          data?.msgId ||
          `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: uniqueId,
        uniqueId,
        username: uniqueId,
        nickname,
        comment,
        text: comment,
        avatar: profilePictureUrl,
        profilePictureUrl,
        timestamp: Date.now(),
      };

      pushAndEmitToSession(session, "chat-message", chatPayload);
    });

    activeConn.on(WebcastEvent.LIKE, (data: any) => {
      const uniqueId = String(
        data?.user?.uniqueId || data?.uniqueId || "viewer",
      )
        .trim()
        .replace(/^@+/, "");
      const nickname = String(
        data?.user?.nickname || data?.nickname || uniqueId || "Viewer",
      )
        .trim()
        .replace(/^@+/, "");
      const profilePictureUrl =
        extractProfilePicture(data) ||
        `https://i.pravatar.cc/150?u=${encodeURIComponent(uniqueId || nickname)}`;
      const likeCount = Number(data?.likeCount) || 1;
      const totalLikeCount = Number(data?.totalLikeCount) || likeCount;

      const likePayload = {
        userId: uniqueId,
        uniqueId,
        username: uniqueId,
        nickname,
        profilePictureUrl,
        avatar: profilePictureUrl,
        likeCount,
        totalLikeCount,
        timestamp: Date.now(),
      };

      pushAndEmitToSession(session, "like-event", likePayload);
    });

    activeConn.on(WebcastEvent.GIFT, (data: any) => {
      if (data?.giftType === 1 && !data?.repeatEnd) return;
      const uniqueId = String(
        data?.user?.uniqueId || data?.uniqueId || "viewer",
      )
        .trim()
        .replace(/^@+/, "");
      const nickname = String(
        data?.user?.nickname || data?.nickname || uniqueId || "Viewer",
      )
        .trim()
        .replace(/^@+/, "");
      const profilePictureUrl =
        extractProfilePicture(data) ||
        `https://i.pravatar.cc/150?u=${encodeURIComponent(uniqueId || nickname)}`;
      const repeatCount = Number(data?.repeatCount) || 1;
      const diamondCount = Number(data?.diamondCount) || 1;

      const giftPayload = {
        userId: uniqueId,
        uniqueId,
        username: uniqueId,
        nickname,
        giftName: String(data?.giftName || data?.gift?.name || "Gift"),
        giftId: data?.giftId || 0,
        repeatCount,
        diamondCount: diamondCount * repeatCount,
        repeatEnd: true,
        profilePictureUrl,
        avatar: profilePictureUrl,
        timestamp: Date.now(),
      };

      pushAndEmitToSession(session, "gift-event", giftPayload);
    });

    activeConn.on(ControlEvent.DISCONNECTED, () => {
      if (session.tiktokConn === activeConn) {
        session.tiktokConn = null;
        // Keep session alive in LIVE_RELAY mode and schedule background reconnect
        // unless the user explicitly disconnected
        if (session.connectedUsername === cleanUsername && !session.isTestMode) {
          session.connectedRoomId = "LIVE_RELAY";
          scheduleBackgroundTikTokRetry(session, cleanUsername);
        }
      }
    });

    activeConn.on(ControlEvent.ERROR, (err: any) => {
      console.warn("TikTok connection notice:", err?.info || err?.message || err);
    });
  }

  function scheduleBackgroundTikTokRetry(session: any, cleanUsername: string) {
    clearSessionRetryTimer(session);
    if (
      session.isTestMode ||
      !session.connectedUsername ||
      session.connectedUsername !== cleanUsername
    ) {
      return;
    }
    session.retryTimer = setTimeout(async () => {
      session.retryTimer = null;
      if (
        !session.connectedUsername ||
        session.connectedUsername !== cleanUsername ||
        session.tiktokConn ||
        session.isTestMode
      ) {
        return;
      }
      try {
        const conn = new TikTokLiveConnection(cleanUsername, {
          processInitialData: false,
          enableExtendedGiftInfo: false,
        });
        const state = await conn.connect();
        if (session.connectedUsername !== cleanUsername) {
          try {
            conn.disconnect();
          } catch {}
          return;
        }
        session.tiktokConn = conn;
        session.connectedRoomId = state?.roomId || `LIVE_${cleanUsername}`;
        attachTikTokConnListeners(session, conn, cleanUsername);
        emitConnectedState(session, undefined);
      } catch {
        // Still offline or using webhook relay; retry again in 15s while session is active
        if (
          session.connectedUsername === cleanUsername &&
          Date.now() - session.lastActiveAt < 20 * 60 * 1000
        ) {
          scheduleBackgroundTikTokRetry(session, cleanUsername);
        }
      }
    }, 15000);
  }

  async function connectSessionTikTokStream(
    session: any,
    rawUsername: string,
    gameId?: string,
    options: {
      isTestMode?: boolean;
      provider?: string;
      forceReconnect?: boolean;
    } = {},
  ) {
    const cleanUsername = String(rawUsername || "")
      .trim()
      .replace(/^@+/, "");
    if (!cleanUsername) {
      return { connected: false, error: "Username is required" };
    }

    const isTestMode = Boolean(options?.isTestMode);
    const provider =
      options?.provider === "bettertok" ? "bettertok" : "tikfinity";
    const forceReconnect = Boolean(options?.forceReconnect);

    if (gameId) {
      session.connectedGames.add(gameId);
    }
    session.provider = provider;

    // 1. Test / Simulation Mode: connect immediately
    if (isTestMode) {
      closeSessionTikTokConnOnly(session);
      session.isTestMode = true;
      session.connectedUsername = cleanUsername;
      session.connectedRoomId = "TEST_SIMULATION_ROOM";
      emitConnectedState(session, gameId);
      return {
        ok: true,
        connected: true,
        username: cleanUsername,
        roomId: session.connectedRoomId,
        isTestMode: true,
        provider,
      };
    }

    // 2. If already connected to this exact username and not forcing reconnect, reuse active connection
    if (
      !forceReconnect &&
      session.connectedUsername &&
      session.connectedUsername.toLowerCase() === cleanUsername.toLowerCase() &&
      !session.isTestMode
    ) {
      emitConnectedState(session, gameId);
      return {
        ok: true,
        connected: true,
        username: session.connectedUsername,
        roomId: session.connectedRoomId || `LIVE_${cleanUsername}`,
        provider,
      };
    }

    // 3. If a connection attempt to this username is already in-flight, await it instead of killing it
    if (
      !forceReconnect &&
      session.connectingPromise &&
      session.connectedUsername &&
      session.connectedUsername.toLowerCase() === cleanUsername.toLowerCase()
    ) {
      emitConnectedState(session, gameId);
      return session.connectingPromise;
    }

    // 4. Mark session connected immediately so UI & webhook relays are active right away,
    // and attempt direct TikTokLiveConnection in parallel / with fallback to LIVE_RELAY.
    closeSessionTikTokConnOnly(session);
    session.isTestMode = false;
    session.connectedUsername = cleanUsername;
    session.connectedRoomId = `LIVE_${cleanUsername}`;
    emitConnectedState(session, gameId);

    const connectTask = (async () => {
      try {
        const conn = new TikTokLiveConnection(cleanUsername, {
          processInitialData: false,
          enableExtendedGiftInfo: false,
        });
        session.tiktokConn = conn;

        const state = await conn.connect();
        if (session.tiktokConn !== conn) {
          return {
            ok: true,
            connected: true,
            username: session.connectedUsername || cleanUsername,
            roomId: session.connectedRoomId || `LIVE_${cleanUsername}`,
          };
        }

        session.connectedUsername = cleanUsername;
        session.connectedRoomId = state?.roomId || `LIVE_${cleanUsername}`;
        if (gameId) {
          session.connectedGames.add(gameId);
        }

        attachTikTokConnListeners(session, conn, cleanUsername);
        emitConnectedState(session, gameId);

        return {
          ok: true,
          connected: true,
          username: cleanUsername,
          roomId: session.connectedRoomId,
          provider,
        };
      } catch (err) {
        // Direct Webcast connection failed (e.g. streamer is setting up before going live,
        // using TikFinity/BetterTok webhooks, or TikTok sign server rate-limited datacenter IP).
        // Keep session active in LIVE_RELAY mode and retry direct connection in the background!
        if (session.connectedUsername === cleanUsername) {
          session.tiktokConn = null;
          session.connectedRoomId = "LIVE_RELAY";
          if (gameId) {
            session.connectedGames.add(gameId);
          }
          emitConnectedState(session, gameId);
          scheduleBackgroundTikTokRetry(session, cleanUsername);
        }
        const errMsg =
          err instanceof Error
            ? err.message
            : "Live relay active (awaiting live broadcast or webhook events)";
        return {
          ok: true,
          connected: true,
          username: cleanUsername,
          roomId: "LIVE_RELAY",
          provider,
          notice: errMsg,
        };
      } finally {
        session.connectingPromise = null;
      }
    })();

    session.connectingPromise = connectTask;
    return connectTask;
  }

  // Normalize external webhook payloads (TikFinity, BetterTok, custom scripts)
  function ingestWebhookPayload(rawPayload: any, providerName = "tiktok") {
    let payload: any =
      rawPayload && typeof rawPayload === "object" ? { ...rawPayload } : {};
    if (typeof payload.data === "string") {
      try {
        const parsed = JSON.parse(payload.data);
        if (parsed && typeof parsed === "object") {
          payload = { ...payload, ...parsed };
        }
      } catch {}
    } else if (payload.data && typeof payload.data === "object") {
      payload = { ...payload, ...payload.data };
    }
    if (payload.event && typeof payload.event === "object") {
      payload = { ...payload, ...payload.event };
    }

    const user =
      payload.user ||
      payload.sender ||
      payload.author ||
      payload.common?.user ||
      {};
    const rawUnique =
      user.uniqueId ||
      user.displayId ||
      user.username ||
      user.handle ||
      payload.uniqueId ||
      payload.displayId ||
      payload.username ||
      payload.handle ||
      payload.userId ||
      "viewer";
    const uniqueId =
      String(rawUnique).trim().replace(/^@+/, "") || "viewer";
    const rawNick =
      user.nickname ||
      user.nickName ||
      user.displayName ||
      user.name ||
      payload.nickname ||
      payload.nickName ||
      payload.displayName ||
      payload.name ||
      uniqueId;
    const nickname =
      String(rawNick).trim().replace(/^@+/, "") || uniqueId;
    const profilePictureUrl =
      extractProfilePicture(payload) ||
      extractProfilePicture(user) ||
      `https://i.pravatar.cc/150?u=${encodeURIComponent(uniqueId || nickname)}`;

    const eventType = String(
      payload.type || payload.event || payload.eventType || payload.event_type || "",
    ).toLowerCase();

    let normType = null;
    let normData = null;

    if (
      eventType === "gift" ||
      eventType === "gift-event" ||
      payload.giftName ||
      payload.gift_name ||
      payload.diamondCount
    ) {
      normType = "gift-event";
      const repeatCount =
        Number(payload.repeatCount || payload.repeat_count || payload.count) || 1;
      const diamondCount =
        Number(
          payload.diamondCount ||
            payload.diamonds ||
            payload.gift?.diamondCount,
        ) || 1;
      normData = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: uniqueId,
        uniqueId,
        username: uniqueId,
        nickname,
        giftName: String(
          payload.giftName || payload.gift_name || payload.gift?.name || "Gift",
        ),
        giftId: Number(payload.giftId) || 0,
        repeatCount,
        diamondCount: diamondCount * repeatCount,
        repeatEnd: true,
        profilePictureUrl,
        avatar: profilePictureUrl,
        timestamp: Date.now(),
      };
    } else if (
      eventType === "like" ||
      eventType === "like-event" ||
      payload.likeCount ||
      payload.like_count
    ) {
      normType = "like-event";
      const likeCount =
        Number(payload.likeCount || payload.like_count || payload.count) || 1;
      normData = {
        userId: uniqueId,
        uniqueId,
        username: uniqueId,
        nickname,
        likeCount: Math.max(1, likeCount),
        totalLikeCount:
          Number(payload.totalLikeCount || payload.total) || likeCount,
        profilePictureUrl,
        avatar: profilePictureUrl,
        timestamp: Date.now(),
      };
    } else {
      const comment = String(
        payload.comment ||
          payload.content ||
          payload.message ||
          payload.text ||
          payload.word ||
          payload.msg ||
          payload.chatMessage ||
          payload.chat ||
          "",
      ).trim();
      if (comment) {
        normType = "chat-message";
        normData = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          userId: uniqueId,
          uniqueId,
          username: uniqueId,
          nickname,
          comment,
          text: comment,
          profilePictureUrl,
          avatar: profilePictureUrl,
          timestamp: Date.now(),
        };
      }
    }

    if (!normType || !normData) {
      return null;
    }

    globalWebhookCount += 1;
    lastWebhookTime = Date.now();
    lastWebhookProvider = providerName;

    const targetSessionId = payload.sessionId;
    if (targetSessionId) {
      const session = getOrCreateSession(targetSessionId);
      pushAndEmitToSession(session, normType, normData);
    } else {
      // Broadcast to all active sessions when webhook comes from external tool (TikFinity / BetterTok)
      if (sessions.size === 0) {
        const def = getOrCreateSession("default_isolated_session");
        pushAndEmitToSession(def, normType, normData);
      } else {
        for (const sess of sessions.values()) {
          pushAndEmitToSession(sess, normType, normData);
        }
      }
    }

    return { type: normType, payload: normData, provider: providerName };
  }

  // ============================================================================
  // REST Endpoints for TikTok Bridge & Admin Auth
  // ============================================================================
  app.get("/api/tiktok/status", (req, res) => {
    const session = getOrCreateSession(req.query.sessionId);
    const gameId =
      typeof req.query.gameId === "string" ? req.query.gameId.trim() : undefined;
    const isGameConnected = gameId
      ? session.connectedGames.has(gameId) || Boolean(session.connectedUsername)
      : Boolean(session.connectedUsername);
    res.json({
      ok: true,
      connected: isGameConnected,
      username: isGameConnected ? session.connectedUsername || "" : "",
      roomId: session.connectedRoomId || "",
      provider: session.provider || "tikfinity",
      seq: session.eventSeq,
      gameId,
      lastWebhookTime,
      lastWebhookProvider,
      totalWebhooksReceived: globalWebhookCount,
    });
  });

  app.get("/api/tiktok/events", (req, res) => {
    const session = getOrCreateSession(req.query.sessionId);
    const since = Number(req.query.since) || 0;
    const events = session.recentEvents.filter((e: any) => e.seq > since);
    res.json({
      ok: true,
      connected: Boolean(session.connectedUsername),
      username: session.connectedUsername || "",
      roomId: session.connectedRoomId || "",
      seq: session.eventSeq,
      events,
    });
  });

  app.get("/api/tiktok/diagnostic", (req, res) => {
    const session = getOrCreateSession(req.query.sessionId);
    res.json({
      ok: true,
      connected: Boolean(session.connectedUsername),
      username: session.connectedUsername || "",
      roomId: session.connectedRoomId || "",
      provider: session.provider || "tikfinity",
      lastWebhookTime,
      lastWebhookProvider,
      totalWebhooksReceived: globalWebhookCount,
      activeSessions: sessions.size,
      recentEvents: session.recentEvents.slice(-10),
      serverTime: Date.now(),
    });
  });

  app.get("/api/tiktok/sample-words", (_req, res) => {
    const words = [
      "planet",
      "galaxy",
      "orbit",
      "science",
      "history",
      "nature",
      "system",
      "energy",
    ];
    res.json({
      words,
      titleWords: ["planet", "galaxy", "science", "history"],
      rareWords: ["orbit", "nebula", "cosmos", "gravity"],
      commonWords: ["nature", "system", "energy", "world", "time", "year"],
    });
  });

  app.post("/api/tiktok/connect", async (req, res) => {
    const session = getOrCreateSession(
      req.body?.sessionId || req.query.sessionId,
    );
    const result = await connectSessionTikTokStream(
      session,
      req.body?.username || "",
      req.body?.gameId,
      {
        isTestMode: Boolean(req.body?.isTestMode),
        provider: req.body?.provider,
        forceReconnect: Boolean(req.body?.forceReconnect),
      },
    );
    res.json(result);
  });

  app.post("/api/tiktok/disconnect", (req, res) => {
    const session = getOrCreateSession(
      req.body?.sessionId || req.query.sessionId,
    );
    const gameId =
      typeof req.body?.gameId === "string" ? req.body.gameId.trim() : undefined;
    if (gameId) {
      session.connectedGames.delete(gameId);
      io.to(`session:${session.sessionId}`).emit("tiktok-status", {
        connected: false,
        username: "",
        roomId: "",
        gameId,
      });
      io.emit("tiktok-status", {
        connected: false,
        username: "",
        roomId: "",
        gameId,
      });
      io.to(`session:${session.sessionId}`).emit("tiktok-disconnected", {
        gameId,
      });
      io.emit("tiktok-disconnected", { gameId });
      if (session.connectedGames.size === 0) {
        disconnectSessionTikTok(session);
      }
    } else {
      disconnectSessionTikTok(session);
      io.to(`session:${session.sessionId}`).emit("tiktok-status", {
        connected: false,
        username: "",
        roomId: "",
      });
      io.emit("tiktok-status", {
        connected: false,
        username: "",
        roomId: "",
      });
      io.to(`session:${session.sessionId}`).emit("tiktok-disconnected");
      io.emit("tiktok-disconnected");
    }
    res.json({ ok: true, connected: false });
  });

  // External Webhook & Event Ingestion Endpoints (TikFinity, BetterTok, custom scripts)
  app.post("/api/tiktok/event", (req, res) => {
    const result = ingestWebhookPayload(
      { ...req.query, ...req.body },
      "tiktok",
    );
    if (result) {
      res.json({ ok: true, ...result });
      return;
    }
    res.json({ ok: true, status: "ready" });
  });

  app.post("/api/tikfinity/event", (req, res) => {
    const result = ingestWebhookPayload(
      { ...req.query, ...req.body },
      "tikfinity",
    );
    if (result) {
      res.json({ ok: true, ...result });
      return;
    }
    res.json({ ok: true, status: "ready" });
  });

  app.post("/api/bettertok/event", (req, res) => {
    const result = ingestWebhookPayload(
      { ...req.query, ...req.body },
      "bettertok",
    );
    if (result) {
      res.json({ ok: true, ...result });
      return;
    }
    res.json({ ok: true, status: "ready" });
  });

  app.post("/api/tiktok/simulate", (req, res) => {
    const session = getOrCreateSession(
      req.body?.sessionId || req.query.sessionId,
    );
    const { type, payload } = req.body || {};
    if (
      type === "chat-message" ||
      type === "like-event" ||
      type === "gift-event"
    ) {
      const enrichedPayload = { ...(payload || {}) };
      if (type === "chat-message") {
        const uId = String(
          enrichedPayload.uniqueId ||
            enrichedPayload.userId ||
            enrichedPayload.username ||
            "viewer",
        )
          .trim()
          .replace(/^@+/, "");
        const nick = String(enrichedPayload.nickname || uId || "Viewer")
          .trim()
          .replace(/^@+/, "");
        const comment = String(
          enrichedPayload.comment || enrichedPayload.text || "",
        ).trim();
        const pfp =
          cleanUrl(
            enrichedPayload.profilePictureUrl || enrichedPayload.avatar || "",
          ) ||
          `https://i.pravatar.cc/150?u=${encodeURIComponent(uId || nick)}`;
        enrichedPayload.userId = uId;
        enrichedPayload.uniqueId = uId;
        enrichedPayload.username = uId;
        enrichedPayload.nickname = nick;
        enrichedPayload.comment = comment;
        enrichedPayload.text = comment;
        enrichedPayload.profilePictureUrl = pfp;
        enrichedPayload.avatar = pfp;
      }
      pushAndEmitToSession(session, type, enrichedPayload);
      res.json({ ok: true, seq: session.eventSeq });
    } else {
      res.status(400).json({ ok: false, error: "Invalid event type" });
    }
  });

  // Streamer Auth & Activity Endpoints
  app.post("/api/auth/streamer-activity", (req, res) => {
    const session = getOrCreateSession(
      req.body?.sessionId || req.query.sessionId,
    );
    session.lastActiveAt = Date.now();
    res.json({ ok: true });
  });

  app.post("/api/auth/streamer-logout", (req, res) => {
    const session = getOrCreateSession(
      req.body?.sessionId || req.query.sessionId,
    );
    disconnectSessionTikTok(session);
    res.json({ ok: true });
  });

  app.post("/api/auth/validate-streamer", (req, res) => {
    const rawUser = String(req.body?.username || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    const rawKey = String(req.body?.key || "")
      .trim()
      .toUpperCase();
    const streamers = loadServerStreamers();
    const matched = streamers.find(
      (u) =>
        String(u.username || "").toLowerCase() === rawUser &&
        String(u.key || "").toUpperCase() === rawKey,
    );
    if (!matched) {
      res.status(401).json({
        ok: false,
        error: "Invalid @username or LIVE-xxxx-xxxx key.",
      });
      return;
    }
    res.json({ ok: true, user: matched });
  });

  app.get("/api/admin/authorized-users", (_req, res) => {
    res.json({ ok: true, users: loadServerStreamers() });
  });

  app.post("/api/admin/authorized-users", (req, res) => {
    const current = loadServerStreamers();
    if (Array.isArray(req.body?.users)) {
      saveServerStreamers(req.body.users);
      res.json({ ok: true, users: req.body.users });
      return;
    }
    const cleanUser = String(req.body?.username || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    const key = String(req.body?.key || "")
      .trim()
      .toUpperCase();
    if (!cleanUser || !key) {
      res.status(400).json({ ok: false, error: "Username and key required" });
      return;
    }
    const existingIdx = current.findIndex((u) => u.username === cleanUser);
    const record = {
      id:
        existingIdx >= 0
          ? current[existingIdx].id
          : `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      username: cleanUser,
      displayHandle: `@${cleanUser}`,
      key,
      label: req.body?.label ? String(req.body.label).trim() : undefined,
      createdAt: Date.now(),
      createdBy: req.body?.createdBy || "MPAdmin",
    };
    if (existingIdx >= 0) {
      current[existingIdx] = record;
    } else {
      current.unshift(record);
    }
    saveServerStreamers(current);
    res.json({ ok: true, user: record, users: current });
  });

  app.post("/api/admin/login", (req, res) => {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (
      username.toLowerCase() === "mpadmin" &&
      password === "MPPassword1"
    ) {
      res.json({
        ok: true,
        username: "MPAdmin",
        token: `adm_${Date.now()}`,
      });
      return;
    }
    res.status(401).json({ ok: false, error: "Invalid admin credentials" });
  });

  // ============================================================================
  // Socket.IO Handlers (Scoped to client session and global relay)
  // ============================================================================
  io.on("connection", (socket) => {
    const handshakeSessionId =
      typeof socket.handshake.query?.sessionId === "string" &&
      socket.handshake.query.sessionId.trim()
        ? socket.handshake.query.sessionId.trim()
        : socket.id;
    const socketGameId =
      typeof socket.handshake.query?.gameId === "string"
        ? socket.handshake.query.gameId.trim()
        : "";

    let activeSession = getOrCreateSession(handshakeSessionId);
    socket.join(`session:${activeSession.sessionId}`);
    if (activeSession.connectedUsername) {
      socket.join(
        `streamer:${activeSession.connectedUsername.toLowerCase()}`,
      );
    }

    // Send initial status if this session is already connected
    const isThisGameConnected = socketGameId
      ? activeSession.connectedGames.has(socketGameId) ||
        Boolean(activeSession.connectedUsername)
      : Boolean(activeSession.connectedUsername);

    if (isThisGameConnected && activeSession.connectedUsername) {
      socket.emit("tiktok-status", {
        connected: true,
        username: activeSession.connectedUsername,
        roomId: activeSession.connectedRoomId || "",
        gameId: socketGameId || undefined,
      });
    }

    socket.on("join-session", (rawSessionId) => {
      if (typeof rawSessionId === "string" && rawSessionId.trim()) {
        socket.leave(`session:${activeSession.sessionId}`);
        activeSession = getOrCreateSession(rawSessionId.trim());
        socket.join(`session:${activeSession.sessionId}`);
        if (activeSession.connectedUsername) {
          socket.join(
            `streamer:${activeSession.connectedUsername.toLowerCase()}`,
          );
          socket.emit("tiktok-status", {
            connected: true,
            username: activeSession.connectedUsername,
            roomId: activeSession.connectedRoomId || "",
            gameId: socketGameId || undefined,
          });
        }
      }
    });

    socket.on("register-streamer", (payload, ack) => {
      const uname =
        payload && typeof payload === "object"
          ? String(payload.username || "")
              .trim()
              .replace(/^@+/, "")
          : "";
      if (payload && typeof payload === "object" && payload.sessionId) {
        socket.leave(`session:${activeSession.sessionId}`);
        activeSession = getOrCreateSession(String(payload.sessionId));
        socket.join(`session:${activeSession.sessionId}`);
      }
      if (uname) {
        socket.join(`streamer:${uname.toLowerCase()}`);
      }
      if (typeof ack === "function") {
        ack({ ok: true, username: uname });
      }
      socket.emit("streamer-registered", { ok: true, username: uname });
    });

    socket.on("streamer-auth-login", (payload, ack) => {
      const uname =
        payload && typeof payload === "object"
          ? String(payload.username || "")
              .trim()
              .replace(/^@+/, "")
          : "";
      if (uname) {
        socket.join(`streamer:${uname.toLowerCase()}`);
      }
      if (typeof ack === "function") {
        ack({ ok: true, username: uname ? `@${uname}` : "@streamer" });
      }
    });

    socket.on("connect-tiktok", async (payload, ack) => {
      let targetUser = "";
      let targetGameId = socketGameId;
      let isTestMode = false;
      let provider = "tikfinity";
      let forceReconnect = false;

      if (typeof payload === "string") {
        targetUser = payload;
      } else if (payload && typeof payload === "object") {
        if (typeof payload.sessionId === "string" && payload.sessionId.trim()) {
          socket.leave(`session:${activeSession.sessionId}`);
          activeSession = getOrCreateSession(payload.sessionId.trim());
          socket.join(`session:${activeSession.sessionId}`);
        }
        if (typeof payload.gameId === "string" && payload.gameId.trim()) {
          targetGameId = payload.gameId.trim();
        }
        if (typeof payload.username === "string") {
          targetUser = payload.username;
        }
        if (payload.isTestMode) {
          isTestMode = true;
        }
        if (typeof payload.provider === "string") {
          provider = payload.provider;
        }
        if (payload.forceReconnect) {
          forceReconnect = true;
        }
      }

      const cleanUser = targetUser.trim().replace(/^@+/, "");
      if (cleanUser) {
        socket.join(`streamer:${cleanUser.toLowerCase()}`);
      }

      const result = await connectSessionTikTokStream(
        activeSession,
        cleanUser || activeSession.connectedUsername || "streamer",
        targetGameId,
        { isTestMode, provider, forceReconnect },
      );

      if (typeof ack === "function") {
        ack(result);
      }
    });

    socket.on("disconnect-tiktok", (payload) => {
      let targetGameId = socketGameId;
      if (payload && typeof payload === "object") {
        if (typeof payload.gameId === "string" && payload.gameId.trim()) {
          targetGameId = payload.gameId.trim();
        }
        if (typeof payload.sessionId === "string" && payload.sessionId.trim()) {
          activeSession = getOrCreateSession(payload.sessionId.trim());
        }
      }

      if (targetGameId) {
        activeSession.connectedGames.delete(targetGameId);
        socket.emit("tiktok-status", {
          connected: false,
          username: "",
          roomId: "",
          gameId: targetGameId,
        });
        socket.emit("tiktok-disconnected", { gameId: targetGameId });
      }

      if (activeSession.connectedGames.size === 0) {
        disconnectSessionTikTok(activeSession);
        io.to(`session:${activeSession.sessionId}`).emit("tiktok-status", {
          connected: false,
          username: "",
          roomId: "",
        });
        io.emit("tiktok-status", {
          connected: false,
          username: "",
          roomId: "",
        });
        io.to(`session:${activeSession.sessionId}`).emit("tiktok-disconnected");
        io.emit("tiktok-disconnected");
      }
    });

    // Support simulated or client-relayed chat messages into all active listeners
    socket.on("chat-message", (chatPayload) => {
      if (chatPayload && typeof chatPayload === "object") {
        const uniqueId = String(
          chatPayload.uniqueId ||
            chatPayload.userId ||
            chatPayload.username ||
            "viewer",
        )
          .trim()
          .replace(/^@+/, "");
        const nickname = String(chatPayload.nickname || uniqueId || "Viewer")
          .trim()
          .replace(/^@+/, "");
        const comment = String(
          chatPayload.comment || chatPayload.text || "",
        ).trim();
        if (!comment) return;
        const profilePictureUrl =
          cleanUrl(
            chatPayload.profilePictureUrl || chatPayload.avatar || "",
          ) ||
          `https://i.pravatar.cc/150?u=${encodeURIComponent(uniqueId || nickname)}`;
        const payload = {
          id:
            chatPayload.id ||
            `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          userId: uniqueId,
          uniqueId,
          username: uniqueId,
          nickname,
          comment,
          text: comment,
          avatar: profilePictureUrl,
          profilePictureUrl,
          timestamp: chatPayload.timestamp || Date.now(),
        };
        pushAndEmitToSession(activeSession, "chat-message", payload);
      }
    });

    socket.on("like-event", (likePayload) => {
      if (likePayload && typeof likePayload === "object") {
        pushAndEmitToSession(activeSession, "like-event", likePayload);
      }
    });

    socket.on("gift-event", (giftPayload) => {
      if (giftPayload && typeof giftPayload === "object") {
        pushAndEmitToSession(activeSession, "gift-event", giftPayload);
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));

    // Never return index.html for unknown /api/* or /socket.io/* routes
    app.use("/api", (_req, res) => {
      res.status(404).json({ ok: false, error: "API endpoint not found" });
    });

    app.use((req, res, next) => {
      if (req.path.startsWith("/socket.io") || req.path.startsWith("/api/")) {
        next();
        return;
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
