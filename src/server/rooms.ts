import fs from "fs";
import path from "path";
import { RoomState, UserRole } from "../types/socket";

/**
 * State management for Karaoke rooms.
 * Uses in-memory Map for ultra-fast real-time lookup and synchronization,
 * backed by JSON persistence cache to survive page refreshes (F5) and server reloads.
 */
class RoomManager {
  // roomId -> RoomState
  private rooms: Map<string, RoomState> = new Map();

  // socketId -> { roomId, role } for fast cleanup on disconnect
  private socketToRoom: Map<string, { roomId: string; role: UserRole }> = new Map();

  // Path to persistent cache file
  private cacheFilePath = path.join(process.cwd(), ".karaoke_rooms_cache.json");

  constructor() {
    this.loadPersistedRooms();

    // Periodic cleanup of abandoned rooms older than 6 hours
    setInterval(() => {
      this.pruneExpiredRooms(6 * 60 * 60 * 1000);
    }, 15 * 60 * 1000);
  }

  /**
   * Load saved rooms from persistent cache file on startup
   */
  private loadPersistedRooms(): void {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, "utf8");
        const list: RoomState[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const r of list) {
            if (r?.roomId) {
              // Socket connections are ephemeral and reset on server start
              r.host = null;
              r.controllers = [];
              r.adminSocketIds = [];
              this.rooms.set(r.roomId.toUpperCase(), r);
            }
          }
          console.log(`[RoomManager] Restored ${this.rooms.size} rooms from persistence cache.`);
        }
      }
    } catch (e) {
      console.warn("[RoomManager] Failed to load persisted rooms cache:", e);
    }
  }

  /**
   * Persist current rooms state to disk so F5 / restarts retain all queues & songs
   */
  private persistRooms(): void {
    try {
      const data = JSON.stringify(Array.from(this.rooms.values()), null, 2);
      fs.writeFileSync(this.cacheFilePath, data, "utf8");
    } catch (e) {
      console.warn("[RoomManager] Failed to persist rooms cache:", e);
    }
  }

  /**
   * Prune rooms that have had zero activity for more than maxAgeMs
   */
  private pruneExpiredRooms(maxAgeMs: number): void {
    const now = Date.now();
    let prunedCount = 0;
    for (const [id, room] of this.rooms.entries()) {
      if (!room.host && room.controllers.length === 0 && now - room.lastActiveAt > maxAgeMs) {
        this.rooms.delete(id);
        prunedCount++;
      }
    }
    if (prunedCount > 0) {
      console.log(`[RoomManager] Pruned ${prunedCount} inactive rooms older than 6 hours.`);
      this.persistRooms();
    }
  }

  /**
   * Generate a random 4-digit PIN for room administration (e.g., "1234")
   */
  private generateHostPin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  /**
   * Get an existing room or create a new one if it doesn't exist
   */
  public getOrCreateRoom(roomId: string): RoomState {
    const normalizedId = roomId.trim().toUpperCase();
    let room = this.rooms.get(normalizedId);

    if (!room) {
      room = {
        roomId: normalizedId,
        hostPin: this.generateHostPin(),
        host: null,
        adminSocketIds: [],
        controllers: [],
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
        currentSong: null,
        queue: [],
        isPlaying: false,
        currentTime: 0,
        vocalMuted: false,
        pitchShift: 0,
        settings: {
          fairPlayEnabled: false,
          maxQueuePerUser: 3,
          scoringEnabled: true,
        },
      };
      this.rooms.set(normalizedId, room);
      this.persistRooms();
      console.log(`[RoomManager] Created new room: ${normalizedId} with Admin PIN: ${room.hostPin}`);
    }

    if (!room.settings) {
      room.settings = {
        fairPlayEnabled: false,
        maxQueuePerUser: 3,
        scoringEnabled: true,
      };
    }

    return room;
  }

  /**
   * Check if a socket or PIN has admin privileges in the room
   */
  public isAdmin(rawRoomId: string, socketId: string, providedPin?: string): boolean {
    const room = this.getRoom(rawRoomId);
    if (!room) return false;

    // TV Host is always admin
    if (room.host === socketId) return true;

    // Check if socketId is already granted admin
    if (room.adminSocketIds && room.adminSocketIds.includes(socketId)) return true;

    // Check if provided PIN matches hostPin
    if (providedPin && providedPin.trim() === room.hostPin) return true;

    return false;
  }

  /**
   * Claim admin rights using the 4-digit PIN
   */
  public claimAdmin(
    rawRoomId: string,
    socketId: string,
    pin: string
  ): { success: boolean; message: string; room: RoomState | null } {
    const room = this.getRoom(rawRoomId);
    if (!room) {
      return { success: false, message: "Phòng không tồn tại", room: null };
    }

    if (!pin || pin.trim() !== room.hostPin) {
      return { success: false, message: "Mã PIN không chính xác!", room };
    }

    if (!room.adminSocketIds.includes(socketId)) {
      room.adminSocketIds.push(socketId);
    }
    room.lastActiveAt = Date.now();
    this.persistRooms();
    console.log(`👑 [RoomManager] Socket ${socketId} successfully claimed ADMIN for room ${room.roomId}`);

    return {
      success: true,
      message: "Xác thực Chủ phòng thành công!",
      room,
    };
  }

  /**
   * Get room state by roomId
   */
  public getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId.trim().toUpperCase());
  }

  /**
   * Get all active rooms in memory
   */
  public getAllRooms(): RoomState[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Officially close and destroy a room (Host or Admin only).
   * Removes from in-memory Map and clears from disk persistence.
   */
  public closeRoom(
    rawRoomId: string,
    senderSocketId: string,
    providedPin?: string
  ): { success: boolean; message: string; roomId: string } {
    const normalizedId = rawRoomId.trim().toUpperCase();
    const room = this.rooms.get(normalizedId);
    if (!room) {
      return { success: false, message: "Phòng không tồn tại hoặc đã được đóng trước đó.", roomId: normalizedId };
    }

    if (!this.isAdmin(normalizedId, senderSocketId, providedPin)) {
      return { success: false, message: "Chỉ chủ phòng mới có quyền đóng phòng hát!", roomId: normalizedId };
    }

    // Clean up socketToRoom map for all sockets in this room
    for (const [sId, meta] of this.socketToRoom.entries()) {
      if (meta.roomId === normalizedId) {
        this.socketToRoom.delete(sId);
      }
    }

    this.rooms.delete(normalizedId);
    this.persistRooms();
    console.log(`🗑️ [RoomManager] Room ${normalizedId} was permanently closed and deleted.`);
    return { success: true, message: `Phòng ${normalizedId} đã đóng thành công.`, roomId: normalizedId };
  }

  /**
   * Join a socket to a room as either host or controller
   */
  public joinRoom(
    socketId: string,
    rawRoomId: string,
    role: UserRole = "controller",
    pin?: string
  ): {
    success: boolean;
    room: RoomState | null;
    role: UserRole;
    message: string;
    isAdmin: boolean;
    isRoomNotFound?: boolean;
  } {
    const roomId = rawRoomId.trim().toUpperCase();

    // If this socket was already in another room, leave it first
    if (this.socketToRoom.has(socketId)) {
      this.leaveRoom(socketId);
    }

    let room = this.rooms.get(roomId);

    // If role is controller, DO NOT auto-create a non-existent room!
    if (role === "controller" && !room) {
      console.warn(
        `⛔ [RoomManager] Controller ${socketId} attempted to join non-existent room: ${roomId}`
      );
      return {
        success: false,
        isRoomNotFound: true,
        room: null,
        role,
        isAdmin: false,
        message: "Phòng hát không tồn tại hoặc đã bị đóng bởi TV Host!",
      };
    }

    if (!room) {
      room = this.getOrCreateRoom(roomId);
    }
    room.lastActiveAt = Date.now();

    let isUserAdmin = false;

    if (role === "host") {
      const previousHost = room.host;
      room.host = socketId;
      isUserAdmin = true;
      console.log(
        `[RoomManager] Socket ${socketId} joined as HOST for room ${roomId}${
          previousHost ? ` (reconnected / replaced previous host ${previousHost})` : ""
        }`
      );
    } else {
      // Controller role
      if (!room.controllers.includes(socketId)) {
        room.controllers.push(socketId);
      }

      // Check if reconnecting with valid admin PIN
      if (pin && pin.trim() === room.hostPin) {
        if (!room.adminSocketIds.includes(socketId)) {
          room.adminSocketIds.push(socketId);
        }
        isUserAdmin = true;
        console.log(`[RoomManager] Controller ${socketId} restored ADMIN role via PIN in room ${roomId}`);
      } else {
        isUserAdmin = room.adminSocketIds.includes(socketId);
      }

      console.log(
        `[RoomManager] Socket ${socketId} joined as CONTROLLER for room ${roomId} (Admin: ${isUserAdmin}). Total controllers: ${room.controllers.length}`
      );
    }

    this.socketToRoom.set(socketId, { roomId, role });
    this.persistRooms();

    return {
      success: true,
      room,
      role,
      isAdmin: isUserAdmin,
      message: `Joined room ${roomId} as ${role}`,
    };
  }

  /**
   * Remove a socket from their current room without destroying the room!
   * Room data (queue, currentSong, PIN) is intentionally preserved so F5 reload or temporary
   * disconnections do not wipe selected songs.
   */
  public leaveRoom(
    socketId: string,
    specifiedRoomId?: string
  ): { room: RoomState | null; roomId: string; role: UserRole } | null {
    const meta = this.socketToRoom.get(socketId);
    if (!meta) return null;

    const roomId = specifiedRoomId
      ? specifiedRoomId.trim().toUpperCase()
      : meta.roomId;
    const room = this.rooms.get(roomId);

    this.socketToRoom.delete(socketId);

    if (!room) {
      return { room: null, roomId, role: meta.role };
    }

    room.lastActiveAt = Date.now();

    // Remove from admin list if present
    if (room.adminSocketIds && room.adminSocketIds.includes(socketId)) {
      room.adminSocketIds = room.adminSocketIds.filter((id) => id !== socketId);
      console.log(`[RoomManager] Removed ${socketId} from adminSocketIds in room ${roomId}`);
    }

    if (meta.role === "host" && room.host === socketId) {
      room.host = null;
      console.log(`[RoomManager] Host ${socketId} disconnected from room ${roomId} (Room state retained)`);
    } else {
      room.controllers = room.controllers.filter((id) => id !== socketId);
      console.log(
        `[RoomManager] Controller ${socketId} left room ${roomId}. Remaining controllers: ${room.controllers.length}`
      );
    }

    // Retain room in RAM & persistence so when client reconnects/refreshes, state is 100% recovered
    this.persistRooms();
    return { room, roomId, role: meta.role };
  }

  /**
   * Handle socket disconnection
   */
  public handleDisconnect(
    socketId: string
  ): { room: RoomState | null; roomId: string; role: UserRole } | null {
    return this.leaveRoom(socketId);
  }

  /**
   * Update current playback time recorded from Host
   */
  public updateCurrentTime(rawRoomId: string, currentTime: number, duration?: number): void {
    const room = this.getRoom(rawRoomId);
    if (!room) return;
    room.currentTime = currentTime;
    if (typeof duration === "number" && duration > 0) {
      room.duration = duration;
    }
    room.lastActiveAt = Date.now();
  }

  /**
   * Add a song to the room's queue.
   * If no song is currently playing, immediately set it as currentSong.
   * Supports Fair Play limit if enabled by Host (only active when >= 3 controllers).
   */
  public addToQueue(
    rawRoomId: string,
    item: import("../types/socket").QueueItem,
    senderSocketId?: string
  ): { room: RoomState; isImmediatePlay: boolean; error?: string } {
    const room = this.getOrCreateRoom(rawRoomId);
    room.lastActiveAt = Date.now();

    // Check Fair Play: Only when enabled AND >= 3 people in room AND user is not admin
    const controllersCount = room.controllers.length;
    const isSenderAdmin = senderSocketId ? this.isAdmin(rawRoomId, senderSocketId) : false;

    if (
      room.settings?.fairPlayEnabled &&
      controllersCount >= 3 &&
      item.userId &&
      !isSenderAdmin
    ) {
      const userQueueCount = room.queue.filter((q) => q.userId === item.userId).length;
      const maxAllowed = room.settings.maxQueuePerUser || 3;
      if (userQueueCount >= maxAllowed) {
        console.warn(
          `⛔ [Fair Play] Blocked song addition for user ${item.userId}: reached max ${userQueueCount}/${maxAllowed}`
        );
        return {
          room,
          isImmediatePlay: false,
          error: `Bạn đã đặt tối đa ${maxAllowed} bài trong hàng đợi. Vui lòng chờ bài của bạn được hát xong nhé!`,
        };
      }
    }

    if (!room.currentSong) {
      room.currentSong = item;
      room.isPlaying = true;
      room.currentTime = 0;
      console.log(`[RoomManager] Room ${room.roomId}: Now playing immediate "${item.title}"`);
      this.persistRooms();
      return { room, isImmediatePlay: true };
    } else {
      room.queue.push(item);
      console.log(
        `[RoomManager] Room ${room.roomId}: Added "${item.title}" to queue. Queue length: ${room.queue.length}`
      );
      this.persistRooms();
      return { room, isImmediatePlay: false };
    }
  }

  /**
   * Update room settings (Admin only)
   */
  public updateSettings(
    rawRoomId: string,
    newSettings: Partial<import("../types/socket").RoomSettings>,
    senderSocketId: string,
    providedPin?: string
  ): { room: RoomState | null; success: boolean; error?: string } {
    const room = this.getRoom(rawRoomId);
    if (!room) return { room: null, success: false, error: "Phòng không tồn tại" };

    if (!this.isAdmin(rawRoomId, senderSocketId, providedPin)) {
      return { room, success: false, error: "Chỉ chủ phòng mới có quyền thay đổi cài đặt!" };
    }

    room.settings = {
      fairPlayEnabled: false,
      maxQueuePerUser: 3,
      scoringEnabled: true,
      ...(room.settings || {}),
      ...newSettings,
    };
    room.lastActiveAt = Date.now();
    this.persistRooms();
    console.log(`[RoomManager] Room ${room.roomId} updated settings:`, room.settings);
    return { room, success: true };
  }

  /**
   * Prioritize a song in queue to play next (moves to front of queue).
   * Permitted if sender is Admin OR the owner of the queue item (item.userId === senderUserId).
   */
  public prioritizeQueue(
    rawRoomId: string,
    itemId: string,
    senderSocketId: string,
    senderUserId?: string,
    providedPin?: string
  ): { room: RoomState | null; success: boolean; error?: string } {
    const room = this.getRoom(rawRoomId);
    if (!room) return { room: null, success: false, error: "Phòng không tồn tại" };

    const targetItem = room.queue.find((i) => i.id === itemId);
    if (!targetItem) {
      return { room, success: false, error: "Không tìm thấy bài hát trong hàng đợi" };
    }

    const isAdminUser = this.isAdmin(rawRoomId, senderSocketId, providedPin);
    const isOwner = Boolean(
      senderUserId && targetItem.userId && targetItem.userId === senderUserId
    );

    if (!isAdminUser && !isOwner) {
      console.warn(
        `⛔ [Permission Denied] Socket ${senderSocketId} (userId: ${senderUserId}) tried to prioritize song "${targetItem.title}" owned by ${targetItem.userId}`
      );
      return {
        room,
        success: false,
        error: "Bạn chỉ có thể ưu tiên bài hát do chính bạn chọn! Chỉ chủ phòng mới có quyền ưu tiên bài của người khác.",
      };
    }

    const itemIndex = room.queue.findIndex((i) => i.id === itemId);
    if (itemIndex > 0) {
      const [item] = room.queue.splice(itemIndex, 1);
      room.queue.unshift(item);
      room.lastActiveAt = Date.now();
      this.persistRooms();
      console.log(
        `⚡ [RoomManager] Room ${room.roomId}: Prioritized song "${item.title}" to next by ${
          isAdminUser ? "ADMIN" : "OWNER"
        }`
      );
      return { room, success: true };
    }
    return { room, success: itemIndex === 0 };
  }

  /**
   * Remove a song from the queue.
   * Permitted if sender is Admin OR the creator of the queue item (item.userId === senderUserId).
   */
  public removeQueue(
    rawRoomId: string,
    itemId: string,
    senderSocketId: string,
    senderUserId?: string,
    providedPin?: string
  ): { room: RoomState | null; success: boolean; error?: string } {
    const room = this.getRoom(rawRoomId);
    if (!room) return { room: null, success: false, error: "Phòng không tồn tại" };

    const targetItem = room.queue.find((i) => i.id === itemId);
    if (!targetItem) {
      return { room, success: false, error: "Không tìm thấy bài hát trong hàng đợi" };
    }

    const isAdminUser = this.isAdmin(rawRoomId, senderSocketId, providedPin);
    const isOwner = Boolean(
      senderUserId && targetItem.userId && targetItem.userId === senderUserId
    );

    if (!isAdminUser && !isOwner) {
      console.warn(
        `⛔ [Permission Denied] Socket ${senderSocketId} (userId: ${senderUserId}) tried to delete song "${targetItem.title}" owned by ${targetItem.userId}`
      );
      return {
        room,
        success: false,
        error: "Bạn không thể xóa bài hát của người khác! Chỉ chủ phòng hoặc người đặt mới có quyền.",
      };
    }

    const initialLen = room.queue.length;
    room.queue = room.queue.filter((i) => i.id !== itemId);
    room.lastActiveAt = Date.now();
    this.persistRooms();
    console.log(
      `🗑️ [RoomManager] Removed song "${targetItem.title}" from room ${room.roomId} by ${
        isAdminUser ? "ADMIN" : "OWNER"
      }`
    );
    return { room, success: room.queue.length < initialLen };
  }

  /**
   * Advance to the next song in the queue
   */
  public nextSong(
    rawRoomId: string
  ): { room: RoomState | null; currentSong: import("../types/socket").QueueItem | null } {
    const room = this.getRoom(rawRoomId);
    if (!room) return { room: null, currentSong: null };

    room.lastActiveAt = Date.now();

    if (room.queue.length > 0) {
      room.currentSong = room.queue.shift() || null;
      room.isPlaying = true;
      room.currentTime = 0;
      room.pitchShift = 0; // Reset tone to original key for each new song
      console.log(
        `[RoomManager] Room ${room.roomId}: Advanced to next song "${room.currentSong?.title}". Remaining queue: ${room.queue.length}`
      );
    } else {
      room.currentSong = null;
      room.isPlaying = false;
      room.currentTime = 0;
      room.pitchShift = 0;
      console.log(`[RoomManager] Room ${room.roomId}: Queue is empty. Entering Standby mode.`);
    }

    this.persistRooms();
    return { room, currentSong: room.currentSong };
  }

  /**
   * Set playback state (play / pause)
   */
  public setPlayback(rawRoomId: string, isPlaying: boolean): RoomState | null {
    const room = this.getRoom(rawRoomId);
    if (!room) return null;
    room.isPlaying = isPlaying;
    room.lastActiveAt = Date.now();
    this.persistRooms();
    return room;
  }

  /**
   * Set vocal mute state (true = Beat only / false = Full stereo with singer)
   */
  public setVocalMuted(rawRoomId: string, muted: boolean): RoomState | null {
    const room = this.getRoom(rawRoomId);
    if (!room) return null;
    room.vocalMuted = muted;
    room.lastActiveAt = Date.now();
    this.persistRooms();
    return room;
  }

  /**
   * Set pitch shift in semitones (-4 to +4)
   */
  public setPitchShift(rawRoomId: string, pitch: number): RoomState | null {
    const room = this.getRoom(rawRoomId);
    if (!room) return null;
    room.pitchShift = Math.max(-4, Math.min(4, Math.round(pitch)));
    room.lastActiveAt = Date.now();
    this.persistRooms();
    return room;
  }

  /**
   * Shift pitch by delta (+1 / -1)
   */
  public changePitchShift(rawRoomId: string, delta: number): RoomState | null {
    const room = this.getRoom(rawRoomId);
    if (!room) return null;
    const current = room.pitchShift || 0;
    return this.setPitchShift(rawRoomId, current + delta);
  }

  /**
   * Get metadata for a specific socket
   */
  public getSocketMeta(socketId: string): { roomId: string; role: UserRole } | undefined {
    return this.socketToRoom.get(socketId);
  }
}

// Global singleton instance
export const roomManager = new RoomManager();
