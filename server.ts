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

interface ServerRegisteredUser {
  uid: string;
  displayName: string;
  tiktokConnected: boolean;
  linkedTikTokHandle: string;
  tiktokAvatarUrl?: string;
  authProvider: "email" | "google" | "site";
  createdAt: number;
  updatedAt: number;
}

const REGISTERED_USERS_FILE = path.join(DATA_DIR, "registered_users.json");
const AVATARS_DIR = path.join(DATA_DIR, "tiktok_avatars");

interface CachedTikTokAvatar {
  username: string;
  contentType: string;
  dataUrl: string;
  updatedAt: number;
}

const avatarFetchInFlight = new Map<string, Promise<CachedTikTokAvatar | null>>();

function getCachedTikTokAvatarFromDisk(cleanUsername: string): CachedTikTokAvatar | null {
  try {
    const file = path.join(AVATARS_DIR, `${cleanUsername}.json`);
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      if (parsed && typeof parsed.dataUrl === "string" && parsed.dataUrl.startsWith("data:image/")) {
        return parsed as CachedTikTokAvatar;
      }
    }
  } catch {
    // ignore read error
  }
  return null;
}

async function downloadTikTokProfileAvatar(
  rawUsername: unknown,
  forceRefresh = false,
): Promise<CachedTikTokAvatar | null> {
  const cleanUsername = String(rawUsername || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.-]/g, "");
  if (!cleanUsername) return null;

  if (!forceRefresh) {
    const existing = getCachedTikTokAvatarFromDisk(cleanUsername);
    // Use disk cache if less than 7 days old
    if (existing && Date.now() - (existing.updatedAt || 0) < 7 * 24 * 60 * 60 * 1000) {
      return existing;
    }
  }

  const inflight = avatarFetchInFlight.get(cleanUsername);
  if (inflight) return inflight;

  const task = (async (): Promise<CachedTikTokAvatar | null> => {
    try {
      let imageSourceUrl = "";

      // 1. Scrape TikTok profile page for avatarThumb / avatarMedium / avatarLarger
      try {
        const pageRes = await fetch(`https://www.tiktok.com/@${encodeURIComponent(cleanUsername)}`, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
          },
        });
        if (pageRes.ok) {
          const html = await pageRes.text();
          const thumbMatch =
            html.match(/"avatarThumb"\s*:\s*"([^"]+)"/) ||
            html.match(/"avatarMedium"\s*:\s*"([^"]+)"/) ||
            html.match(/"avatarLarger"\s*:\s*"([^"]+)"/);
          if (thumbMatch && thumbMatch[1]) {
            try {
              imageSourceUrl = JSON.parse(`"${thumbMatch[1]}"`);
            } catch {
              imageSourceUrl = thumbMatch[1].replace(/\\u002F/g, "/").replace(/\\u0026/g, "&");
            }
          }
          if (!imageSourceUrl) {
            const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
            if (ogMatch && ogMatch[1] && !ogMatch[1].includes("tiktok-logo")) {
              imageSourceUrl = ogMatch[1].replace(/&amp;/g, "&");
            }
          }
        }
      } catch {
        // Fallback below
      }

      // 2. Download the image bytes from TikTok CDN (or fallback to unavatar.io/tiktok)
      const urlsToTry: string[] = [];
      if (imageSourceUrl) urlsToTry.push(imageSourceUrl);
      urlsToTry.push(`https://unavatar.io/tiktok/${encodeURIComponent(cleanUsername)}?fallback=false`);

      for (const candidateUrl of urlsToTry) {
        try {
          const imgRes = await fetch(candidateUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
              Referer: "https://www.tiktok.com/",
              Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            },
          });
          if (!imgRes.ok) continue;
          const ct = (imgRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
          if (!ct.startsWith("image/")) continue;
          const buf = Buffer.from(await imgRes.arrayBuffer());
          if (buf.length < 200 || buf.length > 2 * 1024 * 1024) continue;

          const dataUrl = `data:${ct};base64,${buf.toString("base64")}`;
          const record: CachedTikTokAvatar = {
            username: `@${cleanUsername}`,
            contentType: ct,
            dataUrl,
            updatedAt: Date.now(),
          };

          try {
            if (!fs.existsSync(AVATARS_DIR)) {
              fs.mkdirSync(AVATARS_DIR, { recursive: true });
            }
            fs.writeFileSync(
              path.join(AVATARS_DIR, `${cleanUsername}.json`),
              JSON.stringify(record),
              "utf8",
            );
            fs.writeFileSync(path.join(AVATARS_DIR, `${cleanUsername}.jpg`), buf);
          } catch {
            // ignore disk write error
          }

          return record;
        } catch {
          // try next candidate
        }
      }
    } finally {
      avatarFetchInFlight.delete(cleanUsername);
    }

    return getCachedTikTokAvatarFromDisk(cleanUsername);
  })();

  avatarFetchInFlight.set(cleanUsername, task);
  return task;
}

function normalizeServerTikTokHandle(raw: unknown): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .toLowerCase();
  return cleaned ? `@${cleaned}` : "";
}

function sanitizeServerDisplayName(raw: unknown): string {
  const text = String(raw || "").trim();
  if (!text) return "Player";
  if (text.toLowerCase().includes("phreakfrog")) return "Missing Piece Host";
  if (text.includes("@")) {
    return (text.split("@")[0] || "Player").slice(0, 40);
  }
  return text.slice(0, 40);
}

function sanitizeRegisteredUserPayload(raw: any): ServerRegisteredUser | null {
  if (!raw || typeof raw !== "object") return null;
  const uid = String(raw.uid || "").trim().slice(0, 128);
  if (!uid) return null;
  const linkedTikTokHandle = normalizeServerTikTokHandle(raw.linkedTikTokHandle);
  const authProvider =
    raw.authProvider === "google" || raw.authProvider === "email"
      ? raw.authProvider
      : "site";
  const now = Date.now();
  return {
    uid,
    displayName: sanitizeServerDisplayName(raw.displayName),
    tiktokConnected: Boolean(linkedTikTokHandle),
    linkedTikTokHandle,
    authProvider,
    createdAt: Number(raw.createdAt) > 0 ? Number(raw.createdAt) : now,
    updatedAt: Number(raw.updatedAt) > 0 ? Number(raw.updatedAt) : now,
  };
}

function loadServerRegisteredUsers(): ServerRegisteredUser[] {
  try {
    if (fs.existsSync(REGISTERED_USERS_FILE)) {
      const raw = fs.readFileSync(REGISTERED_USERS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map(sanitizeRegisteredUserPayload)
          .filter((u): u is ServerRegisteredUser => Boolean(u))
          .sort((a, b) => b.updatedAt - a.updatedAt);
      }
    }
  } catch {
    // ignore read error
  }
  return [];
}

function saveServerRegisteredUsers(list: ServerRegisteredUser[]) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      REGISTERED_USERS_FILE,
      JSON.stringify(list, null, 2),
      "utf8",
    );
  } catch {
    // ignore write error on read-only fs
  }
}

function upsertServerRegisteredUsers(
  incoming: Array<ServerRegisteredUser & { explicitTikTokUpdate?: boolean }>,
): ServerRegisteredUser[] {
  const existing = loadServerRegisteredUsers();
  const map = new Map<string, ServerRegisteredUser>();
  for (const user of existing) {
    map.set(user.uid, user);
  }
  for (const item of incoming) {
    const prev = map.get(item.uid);
    if (!prev) {
      map.set(item.uid, {
        uid: item.uid,
        displayName: item.displayName,
        linkedTikTokHandle: item.linkedTikTokHandle,
        tiktokConnected: Boolean(item.linkedTikTokHandle),
        authProvider: item.authProvider,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    } else {
      const useIncoming = item.updatedAt >= prev.updatedAt;
      const mergedHandle = item.explicitTikTokUpdate
        ? item.linkedTikTokHandle
        : item.linkedTikTokHandle || prev.linkedTikTokHandle;
      const isGenericIncoming =
        !item.displayName ||
        item.displayName === "Player" ||
        item.displayName === "Puzzle Seeker";
      const mergedName =
        !isGenericIncoming && (useIncoming || prev.displayName === "Player")
          ? item.displayName
          : prev.displayName || item.displayName;
      map.set(item.uid, {
        uid: item.uid,
        displayName: mergedName,
        linkedTikTokHandle: mergedHandle,
        tiktokConnected: Boolean(mergedHandle),
        authProvider:
          item.authProvider !== "site" ? item.authProvider : prev.authProvider,
        createdAt: Math.min(prev.createdAt, item.createdAt),
        updatedAt: Math.max(prev.updatedAt, item.updatedAt),
      });
    }
  }
  const merged = Array.from(map.values()).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  saveServerRegisteredUsers(merged);
  return merged;
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    path: "/socket.io",
    cors: { origin: "*", methods: ["GET", "POST", "OPTIONS"] },
    transports: ["polling", "websocket"],
    allowEIO3: true,
    maxHttpBufferSize: 5e6,
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

  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: true }));

  const sessions = new Map();
  const overlaySnapshots = new Map<
    string,
    {
      state: unknown;
      updatedAt: number;
      streamer: string;
      hostSessionId?: string;
      seq?: number;
    }
  >();

  function getNewestOverlaySnapshot(gameId: string, streamer: string) {
    const defaultKey = `overlay:${gameId}:default`;
    const streamerKey = streamer ? `overlay:${gameId}:${streamer}` : defaultKey;
    const defaultSnap = overlaySnapshots.get(defaultKey);
    const streamerSnap = streamer ? overlaySnapshots.get(streamerKey) : undefined;
    if (streamerSnap && defaultSnap) {
      return streamerSnap.updatedAt >= defaultSnap.updatedAt ? streamerSnap : defaultSnap;
    }
    return streamerSnap || defaultSnap;
  }

  function upsertOverlaySnapshot(params: {
    gameId: string;
    streamer: string;
    state: unknown;
    hostSessionId?: string;
    seq?: number;
    senderSocket?: any;
  }) {
    const { gameId, streamer, state, hostSessionId, seq, senderSocket } = params;
    const updatedAt = Date.now();
    const record = {
      state,
      updatedAt,
      streamer,
      hostSessionId,
      seq,
    };
    const defaultKey = `overlay:${gameId}:default`;
    overlaySnapshots.set(defaultKey, record);

    const targetRooms = new Set<string>([defaultKey]);
    if (streamer) {
      const streamerKey = `overlay:${gameId}:${streamer}`;
      overlaySnapshots.set(streamerKey, record);
      targetRooms.add(streamerKey);
    }

    // Also refresh any existing snapshot key for this game so a previous streamer key never serves a stale round
    const prefix = `overlay:${gameId}:`;
    for (const existingKey of overlaySnapshots.keys()) {
      if (existingKey.startsWith(prefix)) {
        overlaySnapshots.set(existingKey, record);
        targetRooms.add(existingKey);
      }
    }

    const packet = {
      gameId,
      streamer,
      state,
      updatedAt,
      hostSessionId,
      seq,
    };

    const roomsArr = Array.from(targetRooms);
    if (senderSocket) {
      senderSocket.to(roomsArr).emit("overlay-state-sync", packet);
    } else {
      io.to(roomsArr).emit("overlay-state-sync", packet);
    }
    return packet;
  }

  app.post("/api/overlay/state", (req, res) => {
    const body = req.body || {};
    const gameId = String(body.gameId || "")
      .trim()
      .toLowerCase();
    const streamer = String(body.streamer || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    if (!gameId || body.state === undefined) {
      res.status(400).json({ ok: false, error: "Missing gameId or state" });
      return;
    }
    const hostSessionId =
      typeof body.hostSessionId === "string" ? body.hostSessionId : undefined;
    const seq = typeof body.seq === "number" ? body.seq : undefined;
    const packet = upsertOverlaySnapshot({
      gameId,
      streamer,
      state: body.state,
      hostSessionId,
      seq,
    });
    res.json({
      ok: true,
      updatedAt: packet.updatedAt,
      hostSessionId: packet.hostSessionId,
      seq: packet.seq,
    });
  });

  app.get("/api/overlay/state", (req, res) => {
    const gameId = String(req.query.gameId || "")
      .trim()
      .toLowerCase();
    const streamer = String(req.query.streamer || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase();
    if (!gameId) {
      res.status(400).json({ ok: false, error: "Missing gameId" });
      return;
    }
    const snap = getNewestOverlaySnapshot(gameId, streamer);
    if (!snap) {
      res.json({ ok: true, hasSnapshot: false });
      return;
    }
    res.json({
      ok: true,
      hasSnapshot: true,
      gameId,
      streamer: snap.streamer,
      state: snap.state,
      updatedAt: snap.updatedAt,
      hostSessionId: snap.hostSessionId,
      seq: snap.seq,
    });
  });

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
      const userObj =
        data?.user || data?.userDetails || data?.author || data?.sender || {};
      const nicknameRaw = String(
        userObj?.nickname || data?.nickname || data?.displayName || "",
      )
        .trim()
        .replace(/^@+/, "");
      const idRaw = String(
        userObj?.uniqueId ||
          userObj?.displayId ||
          userObj?.username ||
          userObj?.userId ||
          userObj?.id ||
          data?.uniqueId ||
          data?.username ||
          data?.userId ||
          "",
      )
        .trim()
        .replace(/^@+/, "");
      const uniqueId =
        idRaw && idRaw.toLowerCase() !== "viewer"
          ? idRaw
          : nicknameRaw && nicknameRaw.toLowerCase() !== "viewer"
            ? nicknameRaw
            : idRaw || "viewer";
      const nickname = nicknameRaw || uniqueId || "Viewer";
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
    const rawNick =
      user.nickname ||
      user.nickName ||
      user.displayName ||
      user.name ||
      payload.nickname ||
      payload.nickName ||
      payload.displayName ||
      payload.name ||
      "";
    const cleanedNick = String(rawNick).trim().replace(/^@+/, "");
    const rawUnique =
      user.uniqueId ||
      user.displayId ||
      user.username ||
      user.handle ||
      user.userId ||
      user.id ||
      payload.uniqueId ||
      payload.displayId ||
      payload.username ||
      payload.handle ||
      payload.userId ||
      "";
    const cleanedUnique = String(rawUnique).trim().replace(/^@+/, "");
    const uniqueId =
      cleanedUnique && cleanedUnique.toLowerCase() !== "viewer"
        ? cleanedUnique
        : cleanedNick && cleanedNick.toLowerCase() !== "viewer"
          ? cleanedNick
          : cleanedUnique || "viewer";
    const nickname = cleanedNick || uniqueId || "Viewer";
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
        const nestedUser =
          enrichedPayload.user ||
          enrichedPayload.userDetails ||
          enrichedPayload.author ||
          enrichedPayload.sender ||
          {};
        const nick = String(
          enrichedPayload.nickname ||
            enrichedPayload.displayName ||
            nestedUser.nickname ||
            nestedUser.displayName ||
            enrichedPayload.uniqueId ||
            enrichedPayload.username ||
            "Viewer",
        )
          .trim()
          .replace(/^@+/, "");
        const candidateId = String(
          enrichedPayload.uniqueId ||
            enrichedPayload.userId ||
            enrichedPayload.username ||
            nestedUser.uniqueId ||
            nestedUser.username ||
            nestedUser.userId ||
            "",
        )
          .trim()
          .replace(/^@+/, "");
        const uId =
          candidateId && candidateId.toLowerCase() !== "viewer"
            ? candidateId
            : nick && nick.toLowerCase() !== "viewer"
              ? nick
              : "viewer";
        const comment = String(
          enrichedPayload.comment || enrichedPayload.text || "",
        ).trim();
        const pfp =
          cleanUrl(
            enrichedPayload.profilePictureUrl ||
              enrichedPayload.avatar ||
              nestedUser.profilePictureUrl ||
              nestedUser.avatar ||
              "",
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

  app.get("/api/admin/registered-users", (_req, res) => {
    const registered = loadServerRegisteredUsers();
    const streamers = loadServerStreamers();
    const byUid = new Map<string, ServerRegisteredUser>();
    const handlesPresent = new Set<string>();

    for (const u of registered) {
      byUid.set(u.uid, u);
      if (u.linkedTikTokHandle) {
        handlesPresent.add(normalizeServerTikTokHandle(u.linkedTikTokHandle));
      }
    }

    for (const st of streamers) {
      const handle = normalizeServerTikTokHandle(st.username || st.displayHandle);
      if (handle && !handlesPresent.has(handle)) {
        const uid = `streamer_${handle.replace(/^@+/, "")}`;
        if (!byUid.has(uid)) {
          const ts = Number(st.createdAt) > 0 ? Number(st.createdAt) : Date.now();
          byUid.set(uid, {
            uid,
            displayName: sanitizeServerDisplayName(st.label || st.username || handle.replace(/^@+/, "")),
            tiktokConnected: true,
            linkedTikTokHandle: handle,
            authProvider: "site",
            createdAt: ts,
            updatedAt: ts,
          });
        }
      }
    }

    const combined = Array.from(byUid.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt,
    );
    res.json({ ok: true, users: combined });
  });

  app.post("/api/registered-users/sync", (req, res) => {
    const candidates: Array<ServerRegisteredUser & { explicitTikTokUpdate?: boolean }> = [];
    if (Array.isArray(req.body?.users)) {
      for (const rawItem of req.body.users) {
        const clean = sanitizeRegisteredUserPayload(rawItem);
        if (clean) {
          candidates.push({
            ...clean,
            explicitTikTokUpdate: Boolean(rawItem?.explicitTikTokUpdate),
          });
        }
      }
    }
    if (req.body?.user) {
      const clean = sanitizeRegisteredUserPayload(req.body.user);
      if (clean) {
        candidates.push({
          ...clean,
          explicitTikTokUpdate: Boolean(
            req.body?.explicitTikTokUpdate ?? req.body?.user?.explicitTikTokUpdate,
          ),
        });
      }
    }
    if (candidates.length === 0) {
      res.status(400).json({ ok: false, error: "Valid user record required" });
      return;
    }
    const merged = upsertServerRegisteredUsers(candidates);
    // Proactively download TikTok profile avatars for any users with a linked TikTok @
    for (const c of candidates) {
      if (c.linkedTikTokHandle) {
        void downloadTikTokProfileAvatar(c.linkedTikTokHandle);
      }
    }
    res.json({ ok: true, count: merged.length, users: merged });
  });

  app.get("/api/tiktok/profile-avatar", async (req, res) => {
    const rawUsername = req.query.username || req.query.handle || "";
    const force = req.query.force === "1" || req.query.force === "true";
    const clean = String(rawUsername || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "");
    if (!clean) {
      res.status(400).json({ ok: false, error: "TikTok username required" });
      return;
    }
    const downloaded = await downloadTikTokProfileAvatar(clean, force);
    if (downloaded && downloaded.dataUrl) {
      res.json({
        ok: true,
        username: `@${clean}`,
        avatarUrl: downloaded.dataUrl,
        endpointUrl: `/api/tiktok/avatar/${encodeURIComponent(clean)}`,
      });
      return;
    }
    res.json({
      ok: false,
      username: `@${clean}`,
      avatarUrl: "",
      endpointUrl: `/api/tiktok/avatar/${encodeURIComponent(clean)}`,
    });
  });

  app.post("/api/tiktok/profile-avatar", async (req, res) => {
    const rawUsername = req.body?.username || req.body?.handle || "";
    const force = Boolean(req.body?.force);
    const clean = String(rawUsername || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "");
    if (!clean) {
      res.status(400).json({ ok: false, error: "TikTok username required" });
      return;
    }
    const downloaded = await downloadTikTokProfileAvatar(clean, force);
    if (downloaded && downloaded.dataUrl) {
      res.json({
        ok: true,
        username: `@${clean}`,
        avatarUrl: downloaded.dataUrl,
        endpointUrl: `/api/tiktok/avatar/${encodeURIComponent(clean)}`,
      });
      return;
    }
    res.json({
      ok: false,
      username: `@${clean}`,
      avatarUrl: "",
      endpointUrl: `/api/tiktok/avatar/${encodeURIComponent(clean)}`,
    });
  });

  app.get("/api/tiktok/avatar/:username", async (req, res) => {
    const clean = String(req.params.username || "")
      .trim()
      .replace(/^@+/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, "");
    if (!clean) {
      res.status(404).end();
      return;
    }
    const downloaded = await downloadTikTokProfileAvatar(clean, false);
    if (downloaded && downloaded.dataUrl) {
      const commaIdx = downloaded.dataUrl.indexOf(",");
      if (commaIdx > 0) {
        const base64 = downloaded.dataUrl.slice(commaIdx + 1);
        const buf = Buffer.from(base64, "base64");
        res.setHeader("Content-Type", downloaded.contentType || "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.send(buf);
        return;
      }
    }
    res.redirect(`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(clean)}`);
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
        const nestedUser =
          chatPayload.user ||
          chatPayload.userDetails ||
          chatPayload.author ||
          chatPayload.sender ||
          {};
        const nickname = String(
          chatPayload.nickname ||
            chatPayload.displayName ||
            nestedUser.nickname ||
            nestedUser.displayName ||
            chatPayload.uniqueId ||
            chatPayload.username ||
            "Viewer",
        )
          .trim()
          .replace(/^@+/, "");
        const candidateId = String(
          chatPayload.uniqueId ||
            chatPayload.userId ||
            chatPayload.username ||
            nestedUser.uniqueId ||
            nestedUser.username ||
            nestedUser.userId ||
            "",
        )
          .trim()
          .replace(/^@+/, "");
        const uniqueId =
          candidateId && candidateId.toLowerCase() !== "viewer"
            ? candidateId
            : nickname && nickname.toLowerCase() !== "viewer"
              ? nickname
              : "viewer";
        const comment = String(
          chatPayload.comment || chatPayload.text || "",
        ).trim();
        if (!comment) return;
        const profilePictureUrl =
          cleanUrl(
            chatPayload.profilePictureUrl ||
              chatPayload.avatar ||
              nestedUser.profilePictureUrl ||
              nestedUser.avatar ||
              "",
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

    const syncHostOverlayMembership = (gameId: string, streamer: string, hostSessionId?: string) => {
      const hostDefaultRoom = `overlay-host:${gameId}:default`;
      socket.join(hostDefaultRoom);
      const trackedRooms = (socket.data.overlayHostRooms as Set<string> | undefined) || new Set<string>();
      trackedRooms.add(hostDefaultRoom);
      if (streamer) {
        const hostStreamerRoom = `overlay-host:${gameId}:${streamer}`;
        socket.join(hostStreamerRoom);
        trackedRooms.add(hostStreamerRoom);
      }
      socket.data.overlayHostRooms = trackedRooms;
      if (hostSessionId) {
        socket.data.overlayHostSessionId = hostSessionId;
      }
    };

    const cleanupHostRoomSnapshots = (hostRoom: string) => {
      const room = io.sockets.adapter.rooms.get(hostRoom);
      const remaining = room ? room.size : 0;
      if (remaining > 0) return;
      const snapKey = hostRoom.replace(/^overlay-host:/, "overlay:");
      overlaySnapshots.delete(snapKey);
    };

    socket.on("register-overlay-host", (payload) => {
      if (!payload || typeof payload !== "object") return;
      const gameId = String(payload.gameId || "").trim().toLowerCase();
      const streamer = String(payload.streamer || "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();
      const hostSessionId =
        typeof payload.hostSessionId === "string" ? payload.hostSessionId : undefined;
      if (!gameId) return;
      syncHostOverlayMembership(gameId, streamer, hostSessionId);
    });

    socket.on("overlay-host-leave", (payload) => {
      if (!payload || typeof payload !== "object") return;
      const gameId = String(payload.gameId || "").trim().toLowerCase();
      const streamer = String(payload.streamer || "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();
      if (!gameId) return;
      const hostDefaultRoom = `overlay-host:${gameId}:default`;
      socket.leave(hostDefaultRoom);
      cleanupHostRoomSnapshots(hostDefaultRoom);
      if (streamer) {
        const hostStreamerRoom = `overlay-host:${gameId}:${streamer}`;
        socket.leave(hostStreamerRoom);
        cleanupHostRoomSnapshots(hostStreamerRoom);
      }
    });

    socket.on("disconnecting", () => {
      const trackedRooms = socket.data.overlayHostRooms as Set<string> | undefined;
      if (!trackedRooms || trackedRooms.size === 0) return;
      for (const hostRoom of trackedRooms) {
        const room = io.sockets.adapter.rooms.get(hostRoom);
        const othersRemaining = room ? Array.from(room).filter((id) => id !== socket.id).length : 0;
        if (othersRemaining === 0) {
          const snapKey = hostRoom.replace(/^overlay-host:/, "overlay:");
          overlaySnapshots.delete(snapKey);
        }
      }
    });

    socket.on("join-overlay", (payload) => {
      if (!payload || typeof payload !== "object") return;
      const gameId = String(payload.gameId || "").trim().toLowerCase();
      const streamer = String(payload.streamer || "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();
      if (!gameId) return;

      const defaultRoom = `overlay:${gameId}:default`;
      const roomKey = `overlay:${gameId}:${streamer || "default"}`;
      socket.join(defaultRoom);
      socket.join(roomKey);
      if (streamer) {
        socket.join(`streamer:${streamer}`);
      }

      const snap = getNewestOverlaySnapshot(gameId, streamer);
      if (snap) {
        socket.emit("overlay-state-sync", {
          gameId,
          streamer: snap.streamer,
          state: snap.state,
          updatedAt: snap.updatedAt,
          hostSessionId: snap.hostSessionId,
          seq: snap.seq,
        });
      }

      // Immediately ask any active host for this game/streamer to push its current live round
      const hostTargets = [`overlay-host:${gameId}:default`];
      if (streamer) {
        hostTargets.push(`overlay-host:${gameId}:${streamer}`);
      }
      io.to(hostTargets).emit("overlay-request-state", { gameId, streamer });
    });

    socket.on("overlay-state-update", (payload) => {
      if (!payload || typeof payload !== "object") return;
      const gameId = String(payload.gameId || "").trim().toLowerCase();
      const streamer = String(payload.streamer || "")
        .trim()
        .replace(/^@+/, "")
        .toLowerCase();
      if (!gameId || payload.state === undefined) return;

      const hostSessionId =
        typeof payload.hostSessionId === "string" ? payload.hostSessionId : undefined;
      const seq = typeof payload.seq === "number" ? payload.seq : undefined;

      syncHostOverlayMembership(gameId, streamer, hostSessionId);
      upsertOverlaySnapshot({
        gameId,
        streamer,
        state: payload.state,
        hostSessionId,
        seq,
        senderSocket: socket,
      });
    });
  });

  app.get("/favicon.ico", (_req, res) => {
    const icoPath = path.join(__dirname, "public", "favicon.ico");
    if (fs.existsSync(icoPath)) {
      res.setHeader("Content-Type", "image/x-icon");
      res.setHeader("Cache-Control", "no-cache, must-revalidate");
      res.sendFile(icoPath);
      return;
    }
    const pngPath = path.join(__dirname, "public", "favicon.png");
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(pngPath);
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
