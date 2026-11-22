import crypto from 'node:crypto';
import type express from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import {
  getSessionByToken,
  handleGuestLogin,
  handleLogin,
  handleLogout,
  handleRegister,
  handleUpdateProfile,
  requireAuth,
  type ActiveSession,
} from './auth.ts';
import { GameManager } from './gameManager.ts';
import { store } from './store.ts';
import type { RoomSettings } from '../../src/inkstream/shared/types.ts';

export function mountInkStream(
  app: express.Express,
  io: SocketIOServer
): { gameManager: GameManager } {
  const inkstreamIo = io.of('/inkstream');
  const gameManager = new GameManager(inkstreamIo);

  // --- InkStream Auth REST Routes ---
  app.post('/api/inkstream/auth/register', (req, res) => {
    void handleRegister(req, res);
  });
  app.post('/api/inkstream/auth/login', (req, res) => {
    void handleLogin(req, res);
  });
  app.post('/api/inkstream/auth/guest', handleGuestLogin);
  app.post('/api/inkstream/auth/logout', handleLogout);
  app.get('/api/inkstream/auth/me', requireAuth, (req, res) => {
    const session = (req as express.Request & { session?: ActiveSession }).session!;
    res.json({ user: session.user });
  });
  app.patch('/api/inkstream/auth/profile', requireAuth, handleUpdateProfile);

  // --- InkStream Rooms, Analytics & TikTok Webhook REST Routes ---
  app.get('/api/inkstream/rooms/public', (_req, res) => {
    res.json({ rooms: gameManager.listPublicRooms() });
  });

  app.get('/api/inkstream/rooms/:roomId/analytics', requireAuth, (req, res) => {
    const session = (req as express.Request & { session?: ActiveSession }).session!;
    const roomId = String(req.params.roomId || '').trim().toUpperCase();
    const ownerId = gameManager.getRoomOwnerId(roomId);
    if (!ownerId) {
      res.status(404).json({ error: 'Room not found.' });
      return;
    }
    if (ownerId !== session.user.id) {
      res.status(403).json({ error: 'Only the lobby owner can view room analytics.' });
      return;
    }
    const analytics = gameManager.getAnalyticsForRoom(roomId, session.user.id);
    res.json({ analytics });
  });

  app.post('/api/inkstream/rooms/:roomId/tiktok-webhook', requireAuth, (req, res) => {
    const session = (req as express.Request & { session?: ActiveSession }).session!;
    const roomId = String(req.params.roomId || '').trim().toUpperCase();
    const comment = typeof req.body?.comment === 'string' ? req.body.comment : '';
    const uniqueId = typeof req.body?.uniqueId === 'string' ? req.body.uniqueId : undefined;
    const nickname = typeof req.body?.nickname === 'string' ? req.body.nickname : undefined;
    const profilePictureUrl =
      typeof req.body?.profilePictureUrl === 'string' ? req.body.profilePictureUrl : undefined;
    const result = gameManager.injectTikTokWebhook(roomId, session.user.id, {
      uniqueId,
      nickname,
      comment,
      profilePictureUrl,
    });
    if (!result.ok) {
      res.status(403).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  // --- InkStream Saved Personal Artwork Gallery Routes ---
  app.get('/api/inkstream/artworks', requireAuth, (req, res) => {
    const session = (req as express.Request & { session?: ActiveSession }).session!;
    const artworks = store.listUserArtworks(session.user.id);
    res.json({ artworks });
  });

  app.post('/api/inkstream/artworks', requireAuth, (req, res) => {
    const session = (req as express.Request & { session?: ActiveSession }).session!;
    const word = typeof req.body?.word === 'string' ? req.body.word.trim().slice(0, 60) : 'Sketch';
    const artistName =
      typeof req.body?.artistName === 'string'
        ? req.body.artistName.trim().slice(0, 30)
        : session.user.username;
    const roomName =
      typeof req.body?.roomName === 'string'
        ? req.body.roomName.trim().slice(0, 40)
        : 'InkStream Studio';
    const dataUrl = typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : '';
    if (!dataUrl.startsWith('data:image/png;base64,') || dataUrl.length > 3_500_000) {
      res.status(400).json({ error: 'Invalid PNG artwork data.' });
      return;
    }
    const saved = store.saveArtwork({
      id: `saved_${crypto.randomBytes(6).toString('hex')}`,
      userId: session.user.id,
      word,
      artistName,
      roomName,
      dataUrl,
      createdAt: Date.now(),
    });
    res.status(201).json({ artwork: saved });
  });

  app.delete('/api/inkstream/artworks/:id', requireAuth, (req, res) => {
    const session = (req as express.Request & { session?: ActiveSession }).session!;
    const id = String(req.params.id || '');
    const deleted = store.deleteUserArtwork(session.user.id, id);
    if (!deleted) {
      res.status(404).json({ error: 'Artwork not found.' });
      return;
    }
    res.json({ ok: true });
  });

  // --- Isolated Socket.IO Namespace Middleware (/inkstream) ---
  inkstreamIo.use((socket, next) => {
    const auth = socket.handshake.auth as {
      token?: string;
      streamerRoomId?: string;
      streamerSecret?: string;
    };
    if (
      typeof auth?.streamerRoomId === 'string' &&
      typeof auth?.streamerSecret === 'string' &&
      auth.streamerRoomId &&
      auth.streamerSecret
    ) {
      const roomId = auth.streamerRoomId.trim().toUpperCase();
      if (!gameManager.verifyStreamerPopupCredentials(roomId, auth.streamerSecret)) {
        next(new Error('INVALID_STREAMER_POPUP_KEY'));
        return;
      }
      socket.data.isStreamerPopup = true;
      socket.data.streamerRoomId = roomId;
      next();
      return;
    }

    const token = typeof auth?.token === 'string' ? auth.token : undefined;
    const session = getSessionByToken(token);
    if (!session) {
      next(new Error('UNAUTHORIZED'));
      return;
    }
    socket.data.session = session;
    next();
  });

  inkstreamIo.on('connection', (socket) => {
    if (socket.data.isStreamerPopup) {
      const roomId = String(socket.data.streamerRoomId || '');
      socket.join(`streamer:${roomId}`);
      const initial = gameManager.getStreamerPopupState(roomId);
      if (initial) {
        socket.emit('streamer:state', initial);
      }
      socket.on('streamer:select-word', (payload: { index: number }) => {
        gameManager.selectWordFromStreamerPopup(roomId, Number(payload?.index));
      });
      return;
    }

    const getUser = () => {
      const token = (socket.data.session as ActiveSession | undefined)?.token;
      const fresh = getSessionByToken(token);
      return fresh?.user ?? (socket.data.session as ActiveSession).user;
    };

    socket.on(
      'room:create',
      (
        settings: Partial<RoomSettings> | undefined,
        ack?: (res: { ok: boolean; roomId?: string; error?: string }) => void
      ) => {
        const room = gameManager.createRoom(getUser(), socket.id, settings);
        ack?.({ ok: true, roomId: room.id });
      }
    );

    socket.on(
      'room:quick-play',
      (
        payloadOrAck?:
          | { language?: RoomSettings['language'] }
          | ((res: { ok: boolean; roomId?: string; error?: string }) => void),
        maybeAck?: (res: { ok: boolean; roomId?: string; error?: string }) => void
      ) => {
        const isAckFirst = typeof payloadOrAck === 'function';
        const ack = isAckFirst ? payloadOrAck : maybeAck;
        const language = !isAckFirst ? payloadOrAck?.language : undefined;
        const room = gameManager.joinOrQuickPlay(getUser(), socket.id, language);
        ack?.({ ok: true, roomId: room.id });
      }
    );

    socket.on(
      'room:join',
      (
        payload: { roomId: string },
        ack?: (res: { ok: boolean; roomId?: string; error?: string }) => void
      ) => {
        const result = gameManager.joinRoom(String(payload?.roomId ?? ''), getUser(), socket.id);
        if (result.error) {
          ack?.({ ok: false, error: result.error });
        } else {
          ack?.({ ok: true, roomId: result.room?.id });
        }
      }
    );

    socket.on('room:leave', () => {
      gameManager.leaveCurrentRoom(socket.id);
    });

    socket.on(
      'room:update-settings',
      (
        patch: Partial<RoomSettings>,
        ack?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const res = gameManager.updateSettings(socket.id, patch ?? {});
        ack?.(res.error ? { ok: false, error: res.error } : { ok: true });
      }
    );

    socket.on(
      'room:kick',
      (
        payload: { targetUserId: string },
        ack?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const res = gameManager.kickPlayer(socket.id, String(payload?.targetUserId ?? ''));
        ack?.(res.error ? { ok: false, error: res.error } : { ok: true });
      }
    );

    // --- TikTok LIVE Socket Events (Host Only) ---
    socket.on(
      'tiktok:connect',
      async (
        payload: { username: string; isTestMode?: boolean },
        ack?: (res: { ok: boolean; status?: unknown; error?: string }) => void
      ) => {
        const result = await gameManager.connectTikTok(
          socket.id,
          String(payload?.username ?? ''),
          Boolean(payload?.isTestMode)
        );
        ack?.(result);
      }
    );

    socket.on(
      'tiktok:disconnect',
      (ack?: (res: { ok: boolean; error?: string }) => void) => {
        const res = gameManager.disconnectTikTok(socket.id);
        ack?.(res);
      }
    );

    socket.on(
      'tiktok:test-chat',
      (
        payload: { nickname: string; text: string; profilePictureUrl?: string; uniqueId?: string },
        ack?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const res = gameManager.injectTikTokTestChat(
          socket.id,
          String(payload?.nickname ?? 'viewer'),
          String(payload?.text ?? ''),
          typeof payload?.profilePictureUrl === 'string' ? payload.profilePictureUrl : undefined,
          typeof payload?.uniqueId === 'string' ? payload.uniqueId : undefined
        );
        ack?.(res);
      }
    );

    socket.on(
      'game:start',
      (
        payload: { solo?: boolean } | undefined,
        ack?: (res: { ok: boolean; error?: string }) => void
      ) => {
        const res = gameManager.startGame(socket.id, Boolean(payload?.solo));
        ack?.(res.error ? { ok: false, error: res.error } : { ok: true });
      }
    );

    socket.on('game:solo-finish', () => {
      gameManager.finishSoloTurnEarly(socket.id);
    });

    socket.on(
      'game:return-lobby',
      (ack?: (res: { ok: boolean; error?: string }) => void) => {
        const res = gameManager.returnToLobby(socket.id);
        ack?.(res.error ? { ok: false, error: res.error } : { ok: true });
      }
    );

    socket.on('game:select-word', (payload: { index: number }) => {
      gameManager.selectWord(socket.id, Number(payload?.index));
    });

    socket.on('canvas:command', (command: unknown) => {
      gameManager.handleCanvasCommand(socket.id, command);
    });

    socket.on(
      'canvas:live-segment',
      (segment: {
        strokeId: string;
        tool: string;
        color: string;
        size: number;
        seed: number;
        points: Array<{ x: number; y: number }>;
      }) => {
        gameManager.handleLiveStrokeSegment(socket.id, segment);
      }
    );

    socket.on('canvas:undo', () => {
      gameManager.handleCanvasUndo(socket.id);
    });

    socket.on('canvas:redo', () => {
      gameManager.handleCanvasRedo(socket.id);
    });

    socket.on('canvas:clear', () => {
      gameManager.handleCanvasClear(socket.id);
    });

    socket.on('chat:send', (payload: { text: string }) => {
      gameManager.handleChatMessage(socket.id, payload?.text);
    });

    socket.on('game:react', (payload: { reaction: 'like' | 'dislike' }) => {
      gameManager.handleReaction(socket.id, payload?.reaction);
    });

    socket.on(
      'room:request-analytics',
      (
        payload: { roomId: string },
        ack?: (res: { ok: boolean; analytics?: unknown; error?: string }) => void
      ) => {
        const analytics = gameManager.getAnalyticsForRoom(
          String(payload?.roomId ?? ''),
          getUser().id
        );
        if (!analytics) {
          ack?.({ ok: false, error: 'Only the lobby owner can view room analytics.' });
        } else {
          ack?.({ ok: true, analytics });
        }
      }
    );

    socket.on('disconnect', () => {
      gameManager.leaveCurrentRoom(socket.id);
    });
  });

  return { gameManager };
}
