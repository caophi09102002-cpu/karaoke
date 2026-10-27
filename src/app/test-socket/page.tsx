"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { getSocket } from "@/lib/socket";
import { RoomState, UserRole, PongPayload, SocketLogEntry } from "@/types/socket";
import {
  Activity,
  CheckCircle2,
  Copy,
  Flame,
  Globe,
  Radio,
  RefreshCw,
  Send,
  Tv,
  Smartphone,
  Trash2,
  Users,
  Wifi,
  WifiOff,
  Clock,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

export default function TestSocketPage() {
  // Socket connection states
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string>("");
  const [transport, setTransport] = useState<string>("N/A");

  // Ping-Pong states
  const [lastPong, setLastPong] = useState<PongPayload | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [pingCount, setPingCount] = useState(0);
  const [pongCount, setPongCount] = useState(0);
  const [isAutoPing, setIsAutoPing] = useState(false);
  const [isPinging, setIsPinging] = useState(false);

  // Room states
  const [inputRoomId, setInputRoomId] = useState("KARAOKE-01");
  const [selectedRole, setSelectedRole] = useState<UserRole>("controller");
  const [currentRoom, setCurrentRoom] = useState<RoomState | null>(null);
  const [myJoinedRoomId, setMyJoinedRoomId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<UserRole | null>(null);

  // Logs
  const [logs, setLogs] = useState<SocketLogEntry[]>([]);
  const [copied, setCopied] = useState(false);

  const autoPingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((type: "in" | "out" | "info" | "error", event: string, data: unknown) => {
    const entry: SocketLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString("vi-VN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }),
      type,
      event,
      data,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 99)]);
  }, []);

  // Initialize Socket connection and listeners
  useEffect(() => {
    const socket = getSocket();

    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id || "");
      setTransport(socket.io.engine.transport.name);
      addLog("info", "CONNECT", {
        socketId: socket.id,
        transport: socket.io.engine.transport.name,
      });

      socket.io.engine.on("upgrade", (transport) => {
        setTransport(transport.name);
        addLog("info", "UPGRADE", { transport: transport.name });
      });
    }

    function onDisconnect(reason: string) {
      setIsConnected(false);
      setTransport("disconnected");
      addLog("error", "DISCONNECT", { reason });
    }

    function onPong(payload: PongPayload) {
      const now = Date.now();
      const calculatedLatency = payload.clientTimestamp ? now - payload.clientTimestamp : null;
      setLastPong(payload);
      if (calculatedLatency !== null) {
        setLatency(calculatedLatency);
      }
      setPongCount((prev) => prev + 1);
      setIsPinging(false);
      addLog("in", "pong", { ...payload, clientLatencyMs: calculatedLatency });
    }

    function onRoomJoined(res: { success: boolean; room: RoomState; role: UserRole; message: string }) {
      if (res.success && res.room) {
        setCurrentRoom(res.room);
        setMyJoinedRoomId(res.room.roomId);
        setMyRole(res.role);
        addLog("in", "room-joined", res);
      }
    }

    function onRoomUpdated(data: { roomId: string; room: RoomState | null }) {
      addLog("in", "room-updated", data);
      if (data.room) {
        setCurrentRoom(data.room);
      } else {
        // Room was deleted or empty
        setCurrentRoom(null);
        setMyJoinedRoomId(null);
        setMyRole(null);
      }
    }

    function onError(err: { message: string }) {
      addLog("error", "ERROR", err);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("pong", onPong);
    socket.on("room-joined", onRoomJoined);
    socket.on("room-updated", onRoomUpdated);
    socket.on("error", onError);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("pong", onPong);
      socket.off("room-joined", onRoomJoined);
      socket.off("room-updated", onRoomUpdated);
      socket.off("error", onError);
    };
  }, [addLog]);

  // Handle Send Ping
  const handleSendPing = useCallback(() => {
    const socket = getSocket();
    if (!socket.connected) {
      addLog("error", "PING_FAILED", "Socket chưa kết nối!");
      return;
    }

    setIsPinging(true);
    setPingCount((prev) => prev + 1);

    const clientTimestamp = Date.now();
    const payload = {
      timestamp: clientTimestamp,
      message: "ping",
    };

    addLog("out", "ping", payload);
    socket.emit("ping", payload);
  }, [addLog]);

  // Handle Auto Ping
  useEffect(() => {
    if (isAutoPing && isConnected) {
      autoPingIntervalRef.current = setInterval(() => {
        handleSendPing();
      }, 2000);
    } else {
      if (autoPingIntervalRef.current) {
        clearInterval(autoPingIntervalRef.current);
        autoPingIntervalRef.current = null;
      }
    }

    return () => {
      if (autoPingIntervalRef.current) {
        clearInterval(autoPingIntervalRef.current);
        autoPingIntervalRef.current = null;
      }
    };
  }, [isAutoPing, isConnected, handleSendPing]);

  // Handle Join Room
  const handleJoinRoom = () => {
    const socket = getSocket();
    if (!socket.connected) {
      addLog("error", "JOIN_FAILED", "Socket chưa kết nối!");
      return;
    }

    if (!inputRoomId.trim()) {
      alert("Vui lòng nhập mã phòng (Room ID)");
      return;
    }

    const payload = {
      roomId: inputRoomId.trim().toUpperCase(),
      role: selectedRole,
    };

    addLog("out", "join-room", payload);
    socket.emit("join-room", payload);
  };

  // Handle Leave Room
  const handleLeaveRoom = () => {
    const socket = getSocket();
    if (!socket.connected) return;

    addLog("out", "leave-room", { roomId: myJoinedRoomId });
    socket.emit("leave-room", { roomId: myJoinedRoomId }, () => {
      setCurrentRoom(null);
      setMyJoinedRoomId(null);
      setMyRole(null);
    });
  };

  const copySocketId = () => {
    if (socketId) {
      navigator.clipboard.writeText(socketId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans antialiased selection:bg-rose-500 selection:text-white">
      {/* Background Glow Accents */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-rose-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Connection Ribbon */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-gradient-to-tr from-rose-500 to-purple-600 rounded-xl shadow-lg shadow-rose-500/20 text-white">
                <Radio className="w-6 h-6 animate-pulse" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  Karaoke Socket.IO Testbench
                </h1>
                <p className="text-sm text-slate-400">
                  Custom Server Socket.IO • App Router • In-memory Rooms State
                </p>
              </div>
            </div>
          </div>

          {/* Connection Status Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-300 ${
                isConnected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/20"
                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
              }`}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? "bg-emerald-400 animate-ping" : "bg-rose-500"
                }`}
              />
              {isConnected ? "Đã kết nối Socket" : "Mất kết nối"}
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-800/80 border border-slate-700/60 text-slate-300">
              <Globe className="w-3.5 h-3.5 text-purple-400" />
              Transport: <span className="font-mono text-white uppercase">{transport}</span>
            </div>

            {latency !== null && (
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  latency < 40
                    ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                    : latency < 120
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                RTT: <span className="font-mono font-semibold">{latency} ms</span>
              </div>
            )}
          </div>
        </header>

        {/* Socket ID Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/60 border border-slate-800/80 rounded-xl text-sm">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-400">Socket ID:</span>
            <code className="text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
              {socketId || "Chưa cấp socket ID"}
            </code>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copySocketId}
              disabled={!socketId}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Đã sao chép!
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  Sao chép ID
                </>
              )}
            </button>
            <button
              onClick={() => {
                const s = getSocket();
                s.disconnect().connect();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Kết nối lại
            </button>
          </div>
        </div>

        {/* Main Grid: Ping-Pong & Room Management */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Ping-Pong Playground (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="p-6 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl shadow-xl flex flex-col justify-between h-full space-y-6">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-rose-400" />
                    <h2 className="text-lg font-semibold text-white">Kiểm tra Ping - Pong</h2>
                  </div>
                  <span className="text-xs px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-full font-mono">
                    Event: ping ➡️ pong
                  </span>
                </div>

                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  Nhấn nút bên dưới để gửi sự kiện <code className="text-rose-300">ping</code> kèm theo timestamp lên Custom Server. Server sẽ phản hồi lại sự kiện <code className="text-emerald-300">pong</code> ngay lập tức.
                </p>

                {/* Big Ping Action Button */}
                <div className="mt-6 flex flex-col items-center justify-center p-8 bg-slate-950/60 border border-slate-800/80 rounded-2xl relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 to-transparent pointer-events-none" />

                  <button
                    onClick={handleSendPing}
                    disabled={!isConnected || isPinging}
                    className="relative group/btn cursor-pointer px-8 py-5 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white font-bold text-lg shadow-xl shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none flex items-center gap-3"
                  >
                    <Send className={`w-5 h-5 ${isPinging ? "animate-spin" : "group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform"}`} />
                    <span>Gửi &apos;PING&apos; ngay</span>
                  </button>

                  <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
                    <span>Đã gửi: <b className="text-white font-mono">{pingCount}</b></span>
                    <span>•</span>
                    <span>Đã nhận: <b className="text-emerald-400 font-mono">{pongCount}</b></span>
                  </div>

                  {/* Auto-Ping Toggle */}
                  <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-xs font-medium text-slate-200">Tự động Ping (Auto-Ping)</div>
                      <div className="text-[11px] text-slate-400">Gửi ping định kỳ mỗi 2 giây</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAutoPing}
                        onChange={(e) => setIsAutoPing(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Pong Response Display Box */}
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Kết quả phản hồi PONG gần nhất:
                </div>

                {lastPong ? (
                  <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Nhận &apos;{lastPong.message}&apos; thành công!
                      </span>
                      {latency !== null && (
                        <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">
                          {latency} ms
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300 pt-1">
                      <div>
                        <span className="text-slate-500 block text-[10px]">SERVER TIMESTAMP:</span>
                        {lastPong.serverTimestamp}
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">CLIENT TIMESTAMP:</span>
                        {lastPong.clientTimestamp || "N/A"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-950/40 border border-slate-800/80 rounded-xl text-center text-xs text-slate-500 italic">
                    Chưa có phản hồi pong nào. Hãy nhấn nút &apos;Gửi PING&apos;.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Room Management & In-Memory State (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl shadow-xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">Quản lý Phòng (Rooms State RAM)</h2>
                </div>
                <span className="text-xs px-2.5 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full font-mono">
                  Event: join-room
                </span>
              </div>

              {/* Join Room Controls */}
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Room ID Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Mã phòng (Room ID)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={inputRoomId}
                        onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                        placeholder="VD: KARAOKE-01"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 uppercase"
                      />
                      <button
                        onClick={() => {
                          const randomCode = `ROOM-${Math.floor(100 + Math.random() * 900)}`;
                          setInputRoomId(randomCode);
                        }}
                        title="Tạo mã ngẫu nhiên"
                        className="px-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        Random
                      </button>
                    </div>
                  </div>

                  {/* Role Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      Vai trò của Client (Role)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRole("host")}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          selectedRole === "host"
                            ? "bg-purple-600/20 border-purple-500 text-purple-300 shadow-sm shadow-purple-500/20"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <Tv className="w-4 h-4" />
                        Host (Màn hình)
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedRole("controller")}
                        className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          selectedRole === "controller"
                            ? "bg-rose-600/20 border-rose-500 text-rose-300 shadow-sm shadow-rose-500/20"
                            : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200"
                        }`}
                      >
                        <Smartphone className="w-4 h-4" />
                        Controller (Điện thoại)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleJoinRoom}
                    disabled={!isConnected}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-purple-600/25 hover:shadow-purple-600/40 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    Tham gia phòng (Join Room)
                  </button>

                  {myJoinedRoomId && (
                    <button
                      onClick={handleLeaveRoom}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-rose-300 font-medium text-sm rounded-xl transition-colors cursor-pointer"
                    >
                      Rời phòng hiện tại
                    </button>
                  )}
                </div>
              </div>

              {/* Current Active Room State Viewer */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Trạng thái phòng trên RAM Server (In-Memory State):
                  </div>
                  {currentRoom && (
                    <span className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-full font-mono">
                      Active: {currentRoom.roomId}
                    </span>
                  )}
                </div>

                {currentRoom ? (
                  <div className="p-5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-4">
                    {/* Header of Room */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-3">
                        <span className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg text-white">
                          <Flame className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="text-xs text-slate-400">Mã phòng:</div>
                          <div className="text-lg font-bold font-mono text-purple-300">
                            {currentRoom.roomId}
                          </div>
                        </div>
                      </div>

                      {myRole && (
                        <div className="text-xs px-3 py-1 bg-slate-800 rounded-lg border border-slate-700 text-slate-300">
                          Vai trò của bạn:{" "}
                          <span className="font-semibold text-rose-400 uppercase font-mono">
                            {myRole}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Host Section */}
                    <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                          <Tv className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 font-medium">Host (Màn hình chính)</div>
                          <div className="text-sm font-mono text-slate-200">
                            {currentRoom.host ? (
                              <span className="text-emerald-400">
                                {currentRoom.host}{" "}
                                {currentRoom.host === socketId && (
                                  <span className="text-xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">
                                    (Bạn)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-500 italic">Chưa có Host đăng ký</span>
                            )}
                          </div>
                        </div>
                      </div>
                      {currentRoom.host && (
                        <ShieldCheck className="w-5 h-5 text-emerald-400" />
                      )}
                    </div>

                    {/* Controllers Section */}
                    <div className="p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                          <Smartphone className="w-4 h-4 text-rose-400" />
                          <span>Danh sách Controllers ({currentRoom.controllers.length})</span>
                        </div>
                        <span className="text-[11px] text-slate-500 font-mono">
                          socketIds in RAM
                        </span>
                      </div>

                      {currentRoom.controllers.length > 0 ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {currentRoom.controllers.map((id, index) => {
                            const isMe = id === socketId;
                            return (
                              <div
                                key={id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border ${
                                  isMe
                                    ? "bg-rose-500/20 border-rose-500/40 text-rose-300 font-semibold"
                                    : "bg-slate-800/80 border-slate-700/80 text-slate-300"
                                }`}
                              >
                                <span>#{index + 1}</span>
                                <span>{id}</span>
                                {isMe && (
                                  <span className="text-[10px] bg-rose-500 text-white px-1 rounded">
                                    Bạn
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500 italic py-1">
                          Chưa có controller nào tham gia phòng này.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-950/40 border border-slate-800/80 rounded-2xl text-center text-xs text-slate-500 italic">
                    Chưa tham gia phòng nào. Hãy nhập mã phòng và nhấn &apos;Tham gia phòng&apos; để kiểm tra đồng bộ In-memory Rooms State.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Real-time Socket Event Console / Live Logs */}
        <div className="p-6 bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-slate-800 rounded-lg text-cyan-400">
                <Radio className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-semibold text-white">
                Live Socket Event Logger (Bảng ghi sự kiện thời gian thực)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">
                {logs.length} sự kiện
              </span>
              <button
                onClick={() => setLogs([])}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xoá nhật ký
              </button>
            </div>
          </div>

          <div
            ref={logContainerRef}
            className="max-h-72 overflow-y-auto space-y-2 pr-1 font-mono text-xs select-text scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900"
          >
            {logs.length > 0 ? (
              logs.map((log) => {
                const isOut = log.type === "out";
                const isIn = log.type === "in";
                const isError = log.type === "error";

                return (
                  <div
                    key={log.id}
                    className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[11px]">{log.timestamp}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            isOut
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : isIn
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : isError
                              ? "bg-red-500/20 text-red-300 border border-red-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {log.type}
                        </span>
                        <span className="font-semibold text-slate-200">{log.event}</span>
                      </div>
                    </div>

                    <pre className="text-[11px] text-slate-400 bg-slate-900/90 p-2 rounded-lg overflow-x-auto whitespace-pre-wrap break-all">
                      {typeof log.data === "string"
                        ? log.data
                        : JSON.stringify(log.data, null, 2)}
                    </pre>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 italic">
                Chưa có sự kiện nào được ghi nhận. Hãy gửi ping hoặc tham gia phòng để xem live log.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
