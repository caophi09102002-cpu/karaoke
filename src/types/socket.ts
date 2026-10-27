export interface QueueItem {
  id: string;
  title: string;
  artist: string;
  duration: number;
  source: "local" | "youtube";
  url?: string;
  youtubeId?: string;
  requestedBy: string;
  userId?: string; // ID ngẫu nhiên lưu trong localStorage của người đặt bài
  userName?: string; // Tên hiển thị người đặt
}

export interface RoomState {
  roomId: string;
  hostPin: string; // Mã PIN quản trị 4 chữ số (vd: "1234")
  host: string | null; // socketId of the TV host
  adminSocketIds: string[]; // danh sách socketId có quyền admin
  controllers: string[]; // socketIds of mobile controllers
  createdAt: number;
  lastActiveAt: number;
  currentSong: QueueItem | null;
  queue: QueueItem[];
  isPlaying: boolean;
  currentTime?: number;
  duration?: number;
  vocalMuted?: boolean; // true = Beat only (Left channel cloned), false = Full Stereo
  pitchShift?: number; // -4 to +4 semitones (nửa cung)
}

export type ControllerRole = "admin" | "guest";
export type UserRole = "host" | "controller";

export interface JoinRoomPayload {
  roomId: string;
  role?: UserRole;
  nickname?: string;
  userId?: string;
  pin?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  message?: string;
  room?: RoomState;
  role?: UserRole;
  controllerRole?: ControllerRole;
  hostPin?: string; // Only delivered to Host role
}

export interface SyncStatePayload {
  roomId: string;
  currentSong: QueueItem | null;
  queue: QueueItem[];
  isPlaying: boolean;
  currentTime?: number;
  duration?: number;
  controllersCount: number;
  controllers: string[];
  host: string | null;
  vocalMuted?: boolean;
  pitchShift?: number;
  adminSocketIds?: string[];
}

export type ControlAction =
  | "play"
  | "pause"
  | "skip"
  | "volume"
  | "mute-vocal"
  | "unmute-vocal"
  | "toggle-vocal"
  | "set-pitch"
  | "pitch-up"
  | "pitch-down"
  | "pitch-reset";

export interface ControlPayload {
  roomId: string;
  action: ControlAction;
  value?: any;
  userId?: string;
  pin?: string;
}

export interface ClaimAdminPayload {
  roomId: string;
  pin: string;
  userId?: string;
}

export interface ClaimAdminResponse {
  success: boolean;
  message?: string;
  role?: ControllerRole;
}

export interface RoleUpdatedPayload {
  role: ControllerRole;
  success: boolean;
  message?: string;
}

export interface ServerErrorPayload {
  message: string;
  code?: string;
}

export interface RemoveQueuePayload {
  roomId: string;
  itemId: string;
  userId?: string;
  pin?: string;
}

export interface PrioritizeQueuePayload {
  roomId: string;
  itemId: string;
  userId?: string;
  pin?: string;
}

export type CheerType = "applause" | "whistle" | "cheer" | "heart" | "fire";

export interface CheerPayload {
  roomId: string;
  type: CheerType;
  sender?: string;
}

export interface FloatingCheer {
  id: string;
  emoji: string;
  type: CheerType | string;
  left: number; // percentage 10% - 90%
  animationDuration: number;
}

export interface ReactionPayload {
  roomId: string;
  type: "text" | "emoji";
  content: string; // text message or emoji symbol
  senderName?: string;
  timestamp?: number;
}

export interface DanmakuMessage {
  id: string;
  text: string;
  sender: string;
  color: string;
  topPercent: number; // lane position (10% - 60%)
  durationSec: number;
  createdAt: number;
}

export interface PingPayload {
  timestamp: number;
  message?: string;
}

export interface PongPayload {
  clientTimestamp?: number;
  serverTimestamp: number;
  latencyMs?: number;
  message: string;
}

export interface TimeUpdatePayload {
  roomId: string;
  currentTime: number;
  duration: number;
}

export interface SeekToPayload {
  roomId: string;
  targetTime: number;
}

export interface SocketLogEntry {
  id: string;
  timestamp: string;
  type: "in" | "out" | "info" | "error";
  event: string;
  data: unknown;
}
