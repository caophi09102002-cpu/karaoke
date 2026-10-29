import { createServer } from "http";
import { parse } from "url";
import os from "os";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { roomManager } from "./src/server/rooms";
import {
  JoinRoomPayload,
  JoinRoomResponse,
  PingPayload,
  PongPayload,
  RoomState,
  SyncStatePayload,
} from "./src/types/socket";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

function getLocalIp(): string {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

const localIp = getLocalIp();

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url || "", true);
      const { pathname } = parsedUrl;

      // API to get local network IP for QR code mobile scanning
      if (pathname === "/api/server-info") {
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(
          JSON.stringify({
            lanIp: localIp,
            port,
            localUrl: `http://${localIp}:${port}`,
            publicUrl: "https://red-firefox-26.loca.lt",
          })
        );
        return;
      }

      // Quick in-memory rooms API for debugging/monitoring
      if (pathname === "/api/server-rooms") {
        res.setHeader("Content-Type", "application/json");
        res.statusCode = 200;
        res.end(JSON.stringify({ rooms: roomManager.getAllRooms() }));
        return;
      }

      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // Attach Socket.IO to HTTP Server
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  /**
   * Broadcast room state and server:sync-state to all clients in a room
   */
  const broadcastRoomState = (roomId: string, room: RoomState | null) => {
    const syncData: SyncStatePayload = room
      ? {
          roomId: room.roomId,
          currentSong: room.currentSong,
          queue: room.queue,
          isPlaying: room.isPlaying,
          currentTime: room.currentTime ?? 0,
          duration: room.duration ?? 0,
          controllersCount: room.controllers.length,
          controllers: room.controllers,
          host: room.host,
          vocalMuted: room.vocalMuted ?? false,
          pitchShift: room.pitchShift ?? 0,
          settings: room.settings,
          adminSocketIds: room.adminSocketIds || [],
        }
      : {
          roomId,
          currentSong: null,
          queue: [],
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          controllersCount: 0,
          controllers: [],
          host: null,
          vocalMuted: false,
          pitchShift: 0,
          settings: undefined,
          adminSocketIds: [],
        };

    io.to(roomId).emit("server:sync-state", syncData);
    io.to(roomId).emit("room-updated", { roomId, room });
  };

  io.on("connection", (socket) => {
    console.log(`\n⚡ [Socket Connected] ID: ${socket.id}`);

    // Event: PING - PONG
    socket.on("ping", (payload?: PingPayload, callback?: (res: PongPayload) => void) => {
      const serverTimestamp = Date.now();
      const clientTimestamp = payload?.timestamp;
      const latencyMs = clientTimestamp ? serverTimestamp - clientTimestamp : undefined;

      const pongResponse: PongPayload = {
        clientTimestamp,
        serverTimestamp,
        latencyMs,
        message: "pong",
      };

      socket.emit("pong", pongResponse);
      if (typeof callback === "function") {
        callback(pongResponse);
      }
    });

    // Reusable handler for join room
    const handleJoinRoom = (
      payload: JoinRoomPayload,
      callback?: (res: JoinRoomResponse) => void
    ) => {
      const { roomId, role = "controller", nickname, pin } = payload || {};

      if (!roomId || typeof roomId !== "string" || roomId.trim().length === 0) {
        const errRes: JoinRoomResponse = {
          success: false,
          message: "Mã phòng (roomId) không hợp lệ",
        };
        socket.emit("error", { message: errRes.message });
        if (callback) callback(errRes);
        return;
      }

      // Leave prior rooms
      for (const existingRoom of socket.rooms) {
        if (existingRoom !== socket.id) {
          socket.leave(existingRoom);
        }
      }

      // Register in in-memory state
      const result = roomManager.joinRoom(socket.id, roomId, role, pin);

      if (!result.success || !result.room) {
        const response: JoinRoomResponse = {
          success: false,
          message: result.message,
          isRoomNotFound: result.isRoomNotFound,
          role,
        };
        if (callback) callback(response);
        socket.emit("room-joined", response);
        socket.emit("server:error", { message: result.message });
        return;
      }

      const targetRoomId = result.room.roomId;

      // Join socket.io channel
      socket.join(targetRoomId);

      console.log(
        `👥 [Join Room] Socket: ${socket.id} (${nickname || "Anonymous"}) joined "${targetRoomId}" as ${role.toUpperCase()} (Admin: ${result.isAdmin}, Total Controllers: ${result.room.controllers.length})`
      );

      const response: JoinRoomResponse = {
        success: true,
        message: result.message,
        room: result.room,
        role: result.role,
        controllerRole: result.isAdmin ? "admin" : "guest",
        // Only disclose the secret hostPin to the TV Host screen
        hostPin: role === "host" ? result.room.hostPin : undefined,
      };

      // Notify caller
      if (callback) callback(response);
      socket.emit("room-joined", response);

      // Broadcast updated room state & sync-state to room channel
      broadcastRoomState(targetRoomId, result.room);
    };

    // Support both client:join-room and join-room
    socket.on("client:join-room", handleJoinRoom);
    socket.on("join-room", handleJoinRoom);

    // Event: Close & Destroy Room (Host or Admin only)
    socket.on(
      "client:close-room",
      (payload: { roomId: string; pin?: string }, callback?: (res: any) => void) => {
        const { roomId, pin } = payload || {};
        if (!roomId) return;

        const result = roomManager.closeRoom(roomId, socket.id, pin);
        if (result.success) {
          console.log(`🔒 [Close Room] Room ${roomId} was officially closed by ${socket.id}`);
          io.to(roomId).emit("server:room-closed", {
            roomId,
            reason: "TV Host đã đóng phòng và kết thúc buổi tiệc Karaoke.",
          });
          io.in(roomId).socketsLeave(roomId);
          if (callback) callback({ success: true, message: result.message });
        } else {
          socket.emit("server:error", { message: result.message });
          if (callback) callback({ success: false, message: result.message });
        }
      }
    );

    // Event: Claim Admin via PIN
    socket.on(
      "client:claim-admin",
      (
        payload: { roomId: string; pin: string; userId?: string },
        callback?: (res: { success: boolean; message: string; role?: string }) => void
      ) => {
        const { roomId, pin } = payload || {};
        if (!roomId || !pin) {
          const res = { success: false, message: "Thiếu mã PIN hoặc mã phòng", role: "guest" };
          socket.emit("server:role-updated", res);
          socket.emit("server:error", { message: res.message });
          if (callback) callback(res);
          return;
        }

        const result = roomManager.claimAdmin(roomId, socket.id, pin);
        if (result.success && result.room) {
          const res = { success: true, message: result.message, role: "admin" as const };
          socket.emit("server:role-updated", res);
          if (callback) callback(res);
          // Broadcast to everyone so admin list is updated
          broadcastRoomState(result.room.roomId, result.room);
        } else {
          const res = { success: false, message: result.message, role: "guest" as const };
          socket.emit("server:role-updated", res);
          socket.emit("server:error", { message: result.message });
          if (callback) callback(res);
        }
      }
    );

    // Leave room
    const handleLeaveRoom = (payload?: { roomId?: string }, callback?: (res: any) => void) => {
      const left = roomManager.leaveRoom(socket.id, payload?.roomId);
      if (left) {
        socket.leave(left.roomId);
        console.log(`👋 [Leave Room] Socket ${socket.id} left room ${left.roomId}`);
        broadcastRoomState(left.roomId, left.room);
        io.to(left.roomId).emit("server:notification", {
          type: "disconnect",
          message: "Một thiết bị điều khiển đã ngắt kết nối.",
        });
        if (callback) callback({ success: true, roomId: left.roomId });
      } else {
        if (callback) callback({ success: false, message: "Socket not in any room" });
      }
    };

    socket.on("leave-room", handleLeaveRoom);
    socket.on("client:leave-room", handleLeaveRoom);

    // Request current room state
    socket.on("get-room-state", ({ roomId }: { roomId: string }, callback?: (res: any) => void) => {
      const room = roomManager.getRoom(roomId);
      const res = { room: room || null };
      if (callback) callback(res);
      socket.emit("room-state", res);
      if (room) {
        broadcastRoomState(room.roomId, room);
      }
    });

    // Queue Event: add-queue (With Fair Play checks)
    socket.on("client:add-queue", (payload: { roomId: string; item: import("./src/types/socket").QueueItem }) => {
      const { roomId, item } = payload || {};
      if (!roomId || !item) return;
      const result = roomManager.addToQueue(roomId, item, socket.id);
      if (result.error) {
        socket.emit("server:error", { message: result.error });
        return;
      }
      broadcastRoomState(roomId, result.room);
    });

    // Room Settings Event: update-settings (Admin only)
    socket.on(
      "client:update-settings",
      (payload: {
        roomId: string;
        settings: Partial<import("./src/types/socket").RoomSettings>;
        pin?: string;
      }) => {
        const { roomId, settings, pin } = payload || {};
        if (!roomId || !settings) return;

        const result = roomManager.updateSettings(roomId, settings, socket.id, pin);
        if (!result.success) {
          socket.emit("server:error", {
            message: result.error || "Không thể cập nhật cài đặt phòng!",
          });
          return;
        }

        if (result.room) {
          broadcastRoomState(roomId, result.room);
        }
      }
    );

    // Scoring Event: TV Host broadcasts score result to all devices
    socket.on(
      "host:show-score",
      (payload: {
        roomId: string;
        scoreResult: import("./src/types/socket").ScoreResult;
      }) => {
        const { roomId, scoreResult } = payload || {};
        if (!roomId || !scoreResult) return;
        console.log(`🏆 [Scoring] Room ${roomId}: Score ${scoreResult.score} - ${scoreResult.title}`);
        io.to(roomId).emit("server:show-score", { roomId, scoreResult });
      }
    );

    // Queue Event: prioritize (Admin or Song Owner)
    socket.on(
      "client:prioritize",
      (payload: { roomId: string; itemId: string; userId?: string; pin?: string }) => {
        const { roomId, itemId, userId, pin } = payload || {};
        if (!roomId || !itemId) return;

        const result = roomManager.prioritizeQueue(roomId, itemId, socket.id, userId, pin);
        if (!result.success) {
          socket.emit("server:error", {
            message:
              result.error ||
              "Bạn chỉ có thể ưu tiên bài hát do chính bạn chọn! Chỉ chủ phòng mới có quyền ưu tiên bài của người khác.",
          });
          return;
        }

        if (result.room) {
          broadcastRoomState(roomId, result.room);
        }
      }
    );

    // Queue Event: remove-queue (Admin or song owner only)
    socket.on(
      "client:remove-queue",
      (payload: { roomId: string; itemId: string; userId?: string; pin?: string }) => {
        const { roomId, itemId, userId, pin } = payload || {};
        if (!roomId || !itemId) return;

        const result = roomManager.removeQueue(roomId, itemId, socket.id, userId, pin);
        if (!result.success) {
          socket.emit("server:error", {
            message:
              result.error ||
              "Bạn không thể xóa bài hát của người khác! Chỉ chủ phòng hoặc người đặt mới có quyền.",
          });
          return;
        }

        if (result.room) {
          broadcastRoomState(roomId, result.room);
        }
      }
    );

    // Player Event: song-ended (Host notifies song finished)
    socket.on("client:song-ended", (payload: { roomId: string }) => {
      const { roomId } = payload || {};
      if (!roomId) return;
      console.log(`🎵 [Song Ended] Room ${roomId} requested next song`);
      const result = roomManager.nextSong(roomId);
      if (result.room) {
        broadcastRoomState(roomId, result.room);
      }
    });

    // Control Event: play / pause / skip / tone / vocal
    socket.on("client:control", (payload: import("./src/types/socket").ControlPayload) => {
      const { roomId, action, value, pin, userId } = payload || {};
      if (!roomId || !action) return;

      const room = roomManager.getRoom(roomId);
      const isAdmin = roomManager.isAdmin(roomId, socket.id, pin);
      const isSongOwner = Boolean(
        userId && room?.currentSong?.userId && room.currentSong.userId === userId
      );

      // Skip action: Allowed if Admin OR if the current song was chosen by this user!
      if (action === "skip") {
        if (!isAdmin && !isSongOwner) {
          console.warn(
            `⛔ [Permission Denied] Socket ${socket.id} attempted to skip song "${room?.currentSong?.title}" owned by ${room?.currentSong?.userId}`
          );
          socket.emit("server:error", {
            message:
              "Bạn chỉ có thể bỏ qua bài hát do chính mình chọn! Chỉ chủ phòng mới có quyền bỏ qua bài của người khác.",
          });
          return;
        }

        console.log(
          `⏩ [Skip Authorized] Room ${roomId} skipped by ${isAdmin ? "ADMIN" : "SONG OWNER"}`
        );
        roomManager.nextSong(roomId);
        io.to(roomId).emit("host:control", { action: "skip" });
        const updatedRoom = roomManager.getRoom(roomId);
        if (updatedRoom) {
          broadcastRoomState(roomId, updatedRoom);
        }
        return;
      }

      // Other control actions (play, pause, mute-vocal, pitch): Only Admin or TV Host
      if (!isAdmin) {
        console.warn(`⛔ [Permission Denied] Socket ${socket.id} attempted control action "${action}" in room ${roomId}`);
        socket.emit("server:error", {
          message: "Chỉ chủ phòng mới có quyền điều khiển phát nhạc (Play/Pause/Tone)!",
        });
        return;
      }

      console.log(`🎮 [Control Authorized] Room ${roomId} action: ${action} (value: ${value})`);

      if (action === "play") {
        roomManager.setPlayback(roomId, true);
      } else if (action === "pause") {
        roomManager.setPlayback(roomId, false);
      } else if (action === "mute-vocal") {
        roomManager.setVocalMuted(roomId, true);
      } else if (action === "unmute-vocal") {
        roomManager.setVocalMuted(roomId, false);
      } else if (action === "toggle-vocal") {
        const cur = roomManager.getRoom(roomId)?.vocalMuted ?? false;
        roomManager.setVocalMuted(roomId, !cur);
      } else if (action === "set-pitch" && typeof value === "number") {
        roomManager.setPitchShift(roomId, value);
      } else if (action === "pitch-up") {
        roomManager.changePitchShift(roomId, 1);
      } else if (action === "pitch-down") {
        roomManager.changePitchShift(roomId, -1);
      } else if (action === "pitch-reset") {
        roomManager.setPitchShift(roomId, 0);
      }

      // Forward direct action command to TV Host
      io.to(roomId).emit("host:control", { action, value });

      // Sync state to all devices
      const updated = roomManager.getRoom(roomId);
      if (updated) {
        broadcastRoomState(roomId, updated);
      }
    });

    // Cheer Event: applause, whistle, cheer, etc.
    socket.on("client:cheer-sound", (payload: import("./src/types/socket").CheerPayload) => {
      const { roomId, type = "applause", sender } = payload || {};
      if (!roomId) return;

      console.log(`👏 [Cheer] Room ${roomId} cheer type: ${type} from ${sender || socket.id}`);
      // Broadcast cheer effect to entire room (especially TV Host for audio & floating emojis)
      io.to(roomId).emit("server:cheer-effect", {
        type,
        sender: sender || "Khách",
        timestamp: Date.now(),
      });
    });

    // Live Reactions & Danmaku Barrage Event
    socket.on("client:send-reaction", (payload: import("./src/types/socket").ReactionPayload) => {
      const { roomId, type, content, senderName } = payload || {};
      if (!roomId || !content) return;

      const cleanContent = typeof content === "string" ? content.trim().substring(0, 40) : "";
      if (!cleanContent) return;

      console.log(
        `💬 [Reaction] Room ${roomId}: [${type}] "${cleanContent}" from ${senderName || socket.id}`
      );

      // Broadcast reaction to entire room
      io.to(roomId).emit("server:reaction", {
        roomId,
        type: type === "emoji" ? "emoji" : "text",
        content: cleanContent,
        senderName: senderName || "Khách",
        timestamp: Date.now(),
      });
    });

    // Video Progress / Time Update Event from Host -> Forward to Controllers in room and record in state
    socket.on("host:time-update", (payload: import("./src/types/socket").TimeUpdatePayload) => {
      const { roomId, currentTime, duration } = payload || {};
      if (!roomId || typeof currentTime !== "number") return;
      roomManager.updateCurrentTime(roomId, currentTime, duration);
      socket.to(roomId).emit("host:time-update", {
        roomId,
        currentTime,
        duration: typeof duration === "number" ? duration : 0,
      });
    });

    // Remote Seek Command from Controller -> Forward to TV Host (Admin only)
    socket.on(
      "client:seek-to",
      (payload: import("./src/types/socket").SeekToPayload & { pin?: string }) => {
        const { roomId, targetTime, pin } = payload || {};
        if (!roomId || typeof targetTime !== "number") return;

        if (!roomManager.isAdmin(roomId, socket.id, pin)) {
          socket.emit("server:error", {
            message: "Chỉ chủ phòng mới có quyền tua video bài hát!",
          });
          return;
        }

        console.log(`⏩ [Seek Authorized] Room ${roomId} seek to: ${targetTime}s from ${socket.id}`);
        io.to(roomId).emit("client:seek-to", { roomId, targetTime });
      }
    );

    // Handle Disconnect
    socket.on("disconnect", (reason) => {
      console.log(`❌ [Socket Disconnected] ID: ${socket.id} | Reason: ${reason}`);
      const left = roomManager.handleDisconnect(socket.id);
      if (left) {
        console.log(
          `🧹 [Auto Cleanup] Removed ${socket.id} (${left.role}) from room ${left.roomId}`
        );
        broadcastRoomState(left.roomId, left.room);
      }
    });
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`\n==================================================`);
    console.log(`🚀 Karaoke Next.js Custom Server is RUNNING!`);
    console.log(`📡 Local:   http://localhost:${port}`);
    console.log(`📱 Network: http://${localIp}:${port} (For Mobile QR Scan)`);
    console.log(`🔌 Socket.IO enabled with In-memory Rooms State`);
    console.log(`🧪 Test page: http://localhost:${port}/test-socket`);
    console.log(`==================================================\n`);
  });
});
