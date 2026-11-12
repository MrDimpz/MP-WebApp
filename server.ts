import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
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
export type WebcastPushConnection = TikTokLiveConnection;

function cleanUrl(val: any): string {
  if (!val || typeof val !== "string") return "";
  const s = val.trim();
  if (!s) return "";
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  return "";
}

function extractProfilePicture(data: any): string {
  if (!data) return "";
  const directPfp = cleanUrl(data.profilePictureUrl || data.avatarUrl);
  if (directPfp) return directPfp;

  const user = data.user || data.userDetails || data.author || data;
  const userPfp = cleanUrl(user?.profilePictureUrl || user?.avatarUrl);
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

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  app.use(express.json());

  // Per-User / Per-Session Isolated TikTok Live State
  interface BridgeEventItem {
    seq: number;
    type: "chat-message" | "like-event" | "gift-event";
    payload: Record<string, unknown>;
  }

  interface IsolatedSessionState {
    sessionId: string;
    tiktokConn: TikTokLiveConnection | null;
    connectedUsername: string | null;
    connectedRoomId: string | null;
    connectedGames: Set<string>;
    eventSeq: number;
    recentEvents: BridgeEventItem[];
    lastActiveAt: number;
  }

  const sessions = new Map<string, IsolatedSessionState>();

  function getOrCreateSession(rawSessionId?: unknown): IsolatedSessionState {
    const sessionId =
      typeof rawSessionId === "string" && rawSessionId.trim()
        ? rawSessionId.trim()
        : "default_isolated_session";

    let state = sessions.get(sessionId);
    if (!state) {
      state = {
        sessionId,
        tiktokConn: null,
        connectedUsername: null,
        connectedRoomId: null,
        connectedGames: new Set<string>(),
        eventSeq: 0,
        recentEvents: [],
        lastActiveAt: Date.now(),
      };
      sessions.set(sessionId, state);
    }
    state.lastActiveAt = Date.now();
    return state;
  }

  function pushAndEmitToSession(
    session: IsolatedSessionState,
    type: BridgeEventItem["type"],
    payload: Record<string, unknown>,
  ) {
    session.eventSeq += 1;
    session.lastActiveAt = Date.now();
    const enriched = { ...payload, _seq: session.eventSeq };
    session.recentEvents.push({
      seq: session.eventSeq,
      type,
      payload: enriched,
    });
    if (session.recentEvents.length > 200) {
      session.recentEvents.splice(0, session.recentEvents.length - 200);
    }
    io.to(`session:${session.sessionId}`).emit(type, enriched);
  }

  function disconnectSessionTikTok(session: IsolatedSessionState) {
    if (session.tiktokConn) {
      try {
        session.tiktokConn.disconnect();
      } catch {
        // Ignore disconnect error
      }
      session.tiktokConn = null;
    }
    session.connectedUsername = null;
    session.connectedRoomId = null;
    session.connectedGames.clear();
  }

  async function connectSessionTikTokStream(
    session: IsolatedSessionState,
    rawUsername: string,
    gameId?: string,
  ): Promise<{ connected: boolean; username?: string; error?: string }> {
    const cleanUsername = String(rawUsername || "")
      .trim()
      .replace(/^@+/, "");
    if (!cleanUsername) {
      return { connected: false, error: "Username is required" };
    }

    if (gameId) {
      session.connectedGames.add(gameId);
    }

    disconnectSessionTikTok(session);

    try {
      const conn = new TikTokLiveConnection(cleanUsername, {
        processInitialData: false,
      });
      session.tiktokConn = conn;

      const activeConn = conn;
      const state: any = await activeConn.connect();
      if (session.tiktokConn !== activeConn) {
        return { connected: false, error: "Superseded connection" };
      }

      session.connectedUsername = cleanUsername;
      session.connectedRoomId = state?.roomId || `LIVE_${cleanUsername}`;
      if (gameId) {
        session.connectedGames.add(gameId);
      }

      io.to(`session:${session.sessionId}`).emit("tiktok-connected", {
        username: cleanUsername,
        roomId: session.connectedRoomId,
        gameId,
      });
      io.emit("tiktok-connected", {
        username: cleanUsername,
        roomId: session.connectedRoomId,
        gameId,
      });

      io.to(`session:${session.sessionId}`).emit("tiktok-status", {
        connected: true,
        username: cleanUsername,
        roomId: session.connectedRoomId,
        gameId,
      });
      io.emit("tiktok-status", {
        connected: true,
        username: cleanUsername,
        roomId: session.connectedRoomId,
        gameId,
      });

      // Stream chat event listener (checking both user.uniqueId, user.nickname, comment and content)
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

        const profilePictureUrl = extractProfilePicture(data);
        console.log(`[TikTok Chat] ${nickname} (@${uniqueId}): "${comment}"`);

        const chatPayload = {
          id:
            data.msgId ||
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
        const profilePictureUrl = extractProfilePicture(data);
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
        const profilePictureUrl = extractProfilePicture(data);
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
          profilePictureUrl,
          avatar: profilePictureUrl,
          timestamp: Date.now(),
        };

        pushAndEmitToSession(session, "gift-event", giftPayload);
      });

      activeConn.on(ControlEvent.DISCONNECTED, () => {
        if (session.tiktokConn === activeConn) {
          session.tiktokConn = null;
          session.connectedUsername = null;
          session.connectedRoomId = null;
          session.connectedGames.clear();
        }
        io.to(`session:${session.sessionId}`).emit("tiktok-disconnected");
        io.emit("tiktok-disconnected");
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
      });

      activeConn.on(ControlEvent.ERROR, (err: any) => {
        console.warn("TikTok connection warning:", err?.info || err);
      });

      return { connected: true, username: cleanUsername };
    } catch (err: unknown) {
      session.connectedUsername = null;
      session.connectedRoomId = null;
      session.connectedGames.clear();
      const errMsg =
        err instanceof Error
          ? err.message
          : "Failed to connect to TikTok LIVE. Ensure user is currently live.";
      io.to(`session:${session.sessionId}`).emit("tiktok-status", {
        connected: false,
        error: errMsg,
        gameId,
      });
      io.emit("tiktok-status", {
        connected: false,
        error: errMsg,
        gameId,
      });
      io.to(`session:${session.sessionId}`).emit("tiktok-error", errMsg);
      io.emit("tiktok-error", errMsg);
      return { connected: false, error: errMsg };
    }
  }

  // REST Fallback Endpoints for TikTok Bridge (matching MrDimpz/Squaredint)
  app.get("/api/tiktok/status", (req, res) => {
    const session = getOrCreateSession(req.query.sessionId);
    const gameId =
      typeof req.query.gameId === "string" ? req.query.gameId.trim() : undefined;
    const isGameConnected = gameId
      ? session.connectedGames.has(gameId)
      : Boolean(session.connectedUsername);
    res.json({
      connected: isGameConnected,
      username: isGameConnected ? session.connectedUsername || "" : "",
      roomId: session.connectedRoomId || "",
      seq: session.eventSeq,
      gameId,
    });
  });

  app.get("/api/tiktok/events", (req, res) => {
    const session = getOrCreateSession(req.query.sessionId);
    const since = Number(req.query.since) || 0;
    const events = session.recentEvents.filter((e) => e.seq > since);
    res.json({
      connected: Boolean(session.connectedUsername),
      username: session.connectedUsername || "",
      roomId: session.connectedRoomId || "",
      seq: session.eventSeq,
      events,
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
      io.to(`session:${session.sessionId}`).emit("tiktok-disconnected", { gameId });
      io.emit("tiktok-disconnected", { gameId });
      if (session.connectedGames.size === 0) {
        disconnectSessionTikTok(session);
      }
    } else {
      session.connectedGames.clear();
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
    res.json({ connected: false });
  });

  // REST endpoint from reference repository for external relay tools / OBS scripts / testing
  app.post("/api/tiktok/event", (req, res) => {
    const session = getOrCreateSession(
      req.body?.sessionId || req.query.sessionId,
    );
    const { comment, nickname, uniqueId, profilePictureUrl } = req.body || {};
    const cleanComment = String(
      comment || req.body?.word || req.body?.text || "",
    ).trim();
    if (cleanComment) {
      const uId = String(uniqueId || nickname || "viewer")
        .trim()
        .replace(/^@+/, "");
      const nick = String(nickname || uId || "TikTok Player")
        .trim()
        .replace(/^@+/, "");
      const pfp = cleanUrl(profilePictureUrl || req.body?.avatar || "");
      const payload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId: uId,
        uniqueId: uId,
        username: uId,
        nickname: nick,
        comment: cleanComment,
        text: cleanComment,
        profilePictureUrl: pfp,
        avatar: pfp,
        timestamp: Date.now(),
      };
      pushAndEmitToSession(session, "chat-message", payload);
      res.json({ ok: true, type: "chat" });
      return;
    }
    res.status(400).json({ error: "Missing chat comment" });
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
        const nick = String(
          enrichedPayload.nickname || uId || "Viewer",
        )
          .trim()
          .replace(/^@+/, "");
        const comment = String(
          enrichedPayload.comment || enrichedPayload.text || "",
        ).trim();
        const pfp = cleanUrl(
          enrichedPayload.profilePictureUrl || enrichedPayload.avatar || "",
        );
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

  // Socket.IO Handlers (Scoped to client session and global relay)
  io.on("connection", (socket) => {
    const handshakeSessionId =
      typeof socket.handshake.query?.sessionId === "string"
        ? socket.handshake.query.sessionId
        : socket.id;
    const socketGameId =
      typeof socket.handshake.query?.gameId === "string"
        ? socket.handshake.query.gameId.trim()
        : "";

    let activeSession = getOrCreateSession(handshakeSessionId);
    socket.join(`session:${activeSession.sessionId}`);

    // Send initial status for this specific game
    const isThisGameConnected = socketGameId
      ? activeSession.connectedGames.has(socketGameId)
      : false;

    socket.emit("tiktok-status", {
      connected: isThisGameConnected,
      username: isThisGameConnected
        ? activeSession.connectedUsername || undefined
        : undefined,
      roomId: activeSession.connectedRoomId || "",
      gameId: socketGameId || undefined,
    });

    socket.on("join-session", (rawSessionId: string) => {
      if (typeof rawSessionId === "string" && rawSessionId.trim()) {
        socket.leave(`session:${activeSession.sessionId}`);
        activeSession = getOrCreateSession(rawSessionId.trim());
        socket.join(`session:${activeSession.sessionId}`);
        const isGameConn = socketGameId
          ? activeSession.connectedGames.has(socketGameId)
          : false;
        socket.emit("tiktok-status", {
          connected: isGameConn,
          username: isGameConn
            ? activeSession.connectedUsername || undefined
            : undefined,
          roomId: activeSession.connectedRoomId || "",
          gameId: socketGameId || undefined,
        });
      }
    });

    socket.on("connect-tiktok", async (payload: unknown) => {
      let targetUser = "";
      let targetGameId = socketGameId;
      if (typeof payload === "string") {
        targetUser = payload;
      } else if (payload && typeof payload === "object") {
        const obj = payload as Record<string, unknown>;
        if (typeof obj.sessionId === "string" && obj.sessionId.trim()) {
          socket.leave(`session:${activeSession.sessionId}`);
          activeSession = getOrCreateSession(obj.sessionId.trim());
          socket.join(`session:${activeSession.sessionId}`);
        }
        if (typeof obj.gameId === "string" && obj.gameId.trim()) {
          targetGameId = obj.gameId.trim();
        }
        if (typeof obj.username === "string") {
          targetUser = obj.username;
        }
      }

      if (targetGameId) {
        activeSession.connectedGames.add(targetGameId);
      }

      const cleanUser = targetUser.trim().replace(/^@+/, "");
      if (cleanUser && cleanUser !== activeSession.connectedUsername) {
        await connectSessionTikTokStream(
          activeSession,
          cleanUser,
          targetGameId,
        );
      } else if (activeSession.connectedUsername) {
        // Stream already running on backend, confirm connected for this game
        socket.emit("tiktok-connected", {
          username: activeSession.connectedUsername,
          roomId: activeSession.connectedRoomId || "",
          gameId: targetGameId,
        });
        socket.emit("tiktok-status", {
          connected: true,
          username: activeSession.connectedUsername,
          roomId: activeSession.connectedRoomId || "",
          gameId: targetGameId,
        });
      } else if (cleanUser) {
        await connectSessionTikTokStream(
          activeSession,
          cleanUser,
          targetGameId,
        );
      }
    });

    socket.on("disconnect-tiktok", (payload?: unknown) => {
      let targetGameId = socketGameId;
      if (payload && typeof payload === "object") {
        const obj = payload as Record<string, unknown>;
        if (typeof obj.gameId === "string" && obj.gameId.trim()) {
          targetGameId = obj.gameId.trim();
        }
        if (typeof obj.sessionId === "string" && obj.sessionId.trim()) {
          activeSession = getOrCreateSession(obj.sessionId.trim());
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
        io.to(`session:${activeSession.sessionId}`).emit(
          "tiktok-disconnected",
        );
        io.emit("tiktok-disconnected");
      }
    });

    // Support simulated or client-relayed chat messages into all active listeners
    socket.on("chat-message", (chatPayload: Record<string, unknown>) => {
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
        const profilePictureUrl = cleanUrl(
          chatPayload.profilePictureUrl || chatPayload.avatar || "",
        );
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

    socket.on("like-event", (likePayload: Record<string, unknown>) => {
      if (likePayload && typeof likePayload === "object") {
        pushAndEmitToSession(activeSession, "like-event", likePayload);
      }
    });

    socket.on("gift-event", (giftPayload: Record<string, unknown>) => {
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
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
