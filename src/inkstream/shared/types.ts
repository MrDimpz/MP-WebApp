export interface AvatarConfig {
  color: string;
  eyes: number;
  mouth: number;
  accessory: number;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  wordsGuessed: number;
  bestScore: number;
}

export interface PublicUser {
  id: string;
  username: string;
  email?: string;
  isGuest: boolean;
  isStreamer?: boolean;
  tiktokHandle?: string;
  avatar: AvatarConfig;
  stats: UserStats;
}

export type DrawingTool = 'pencil' | 'eraser' | 'fill';

export interface NormalizedPoint {
  x: number; // 0..1 relative to 800
  y: number; // 0..1 relative to 600
}

export interface StrokeCommand {
  id: string;
  kind: 'stroke';
  tool: 'pencil' | 'eraser';
  color: string;
  size: number; // 1..48 in logical 800x600 pixels
  seed: number;
  points: NormalizedPoint[];
}

export interface FillCommand {
  id: string;
  kind: 'fill';
  color: string;
  x: number; // 0..1
  y: number; // 0..1
}

export type CanvasCommand = StrokeCommand | FillCommand;

export interface RoomSettings {
  name: string;
  isPrivate: boolean;
  streamerMode: boolean;
  maxPlayers: number; // up to 20
  rounds: number;
  drawTime: number; // seconds
  wordChoices: number;
  hintsCount: number;
  customWords: string[];
  customWordsOnly: boolean;
}

export type GamePhase =
  | 'LOBBY'
  | 'WORD_SELECT'
  | 'DRAWING'
  | 'TURN_SUMMARY'
  | 'GAME_OVER';

export interface PlayerState {
  id: string; // userId
  socketId: string;
  username: string;
  avatar: AvatarConfig;
  score: number;
  roundScore: number;
  hasGuessed: boolean;
  isDrawing: boolean;
  isOwner: boolean;
  connected: boolean;
}

export interface TikTokStatus {
  connected: boolean;
  mode: 'disconnected' | 'live' | 'test';
  username: string | null;
  roomId: string | null;
  viewerCount: number;
  chatEventsProcessed: number;
  guessesMatched: number;
  likesCount: number;
  giftsDiamonds: number;
  lastError: string | null;
}

export interface TikTokPlayerScore {
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  score: number;
  roundScore: number;
  wordsGuessed: number;
  hasGuessed: boolean;
  lastGuessSec: number | null;
}

export interface TikTokChatItem {
  id: string;
  uniqueId: string;
  nickname: string;
  profilePictureUrl: string;
  text: string;
  isCorrect: boolean;
  pointsAwarded?: number;
  timestamp: number;
}

export interface StreamerPopupState {
  roomId: string;
  roomName: string;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  isStreamerTurn: boolean;
  drawerName: string;
  wordOptions: string[];
  secretWord: string | null;
  timeRemaining: number;
}

export interface ChatMessage {
  id: string;
  type: 'chat' | 'system' | 'correct' | 'close' | 'guessed-chat';
  senderId?: string;
  senderName?: string;
  text: string;
  timestamp: number;
}

export interface RoundArtwork {
  id: string;
  roomId: string;
  roundNumber: number;
  turnNumber: number;
  word: string;
  drawerId: string;
  drawerName: string;
  drawerAvatar: AvatarConfig;
  commands: CanvasCommand[];
  createdAt: number;
  likes: number;
  dislikes: number;
}

export interface SavedArtworkRecord {
  id: string;
  userId: string;
  word: string;
  artistName: string;
  roomName: string;
  dataUrl: string;
  createdAt: number;
}

export interface RoundHistoryEntry {
  turnNumber: number;
  roundNumber: number;
  word: string;
  drawerId: string;
  drawerName: string;
  startedAt: number;
  endedAt: number;
  durationSec: number;
  eligibleGuessers: number;
  correctGuessers: number;
  guessRate: number; // 0..100
  fastestGuesserName: string | null;
  fastestGuessSec: number | null;
  averageGuessSec: number | null;
  strokeCount: number;
  chatMessagesCount: number;
  likes: number;
  dislikes: number;
  artworkId: string;
  scoreDeltas: Array<{
    playerId: string;
    username: string;
    points: number;
  }>;
}

export interface PlayerEngagementMetric {
  playerId: string;
  username: string;
  avatar: AvatarConfig;
  totalScore: number;
  turnsDrawn: number;
  avgPointsAsDrawer: number;
  guessesAttempted: number;
  guessesCorrect: number;
  guessAccuracy: number; // 0..100
  avgGuessTimeSec: number | null;
  messagesSent: number;
  reactionsGiven: number;
  likesReceived: number;
  dislikesReceived: number;
  engagementIndex: number; // transparent 0..100 participation metric
}

export interface RoomAnalyticsSnapshot {
  roomId: string;
  roomName: string;
  createdAt: number;
  totalRoundsCompleted: number;
  totalTurnsCompleted: number;
  overallGuessRate: number; // 0..100
  avgGuessTimeSec: number | null;
  totalChatMessages: number;
  totalStrokesDrawn: number;
  activePlayersCount: number;
  peakPlayersCount: number;
  playerMetrics: PlayerEngagementMetric[];
  roundHistory: RoundHistoryEntry[];
}

export interface PublicRoomSummary {
  id: string;
  name: string;
  ownerName: string;
  playerCount: number;
  maxPlayers: number;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  streamerMode?: boolean;
}

export interface TurnSummaryData {
  word: string;
  drawerId: string;
  drawerName: string;
  reason: 'all_guessed' | 'time_up' | 'drawer_left' | 'solo_finished';
  scoreDeltas: Array<{
    playerId: string;
    username: string;
    points: number;
  }>;
  artwork: RoundArtwork;
}

export interface RoomClientState {
  id: string;
  ownerId: string;
  streamerSecret: string | null; // ONLY sent to room owner
  settings: RoomSettings;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  turnNumber: number;
  drawerId: string | null;
  maskedWord: string;
  wordLengthHint: number[];
  secretWord: string | null; // hidden on main screen when streamerMode hides streamer's own word
  wordOptions: string[]; // hidden on main screen when streamerMode hides streamer's own word options
  timeRemaining: number;
  phaseTotalTime: number;
  players: PlayerState[];
  messages: ChatMessage[];
  commands: CanvasCommand[];
  canUndo: boolean;
  canRedo: boolean;
  turnSummary: TurnSummaryData | null;
  artworks: RoundArtwork[];
  myReaction: 'like' | 'dislike' | null;
  isSoloMode: boolean;
  tiktokStatus: TikTokStatus;
  tiktokLeaderboard: TikTokPlayerScore[];
  tiktokChat: TikTokChatItem[];
}
