"use client";

import React, { useEffect, useState, useRef, useCallback, use } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { QRCodeSVG } from "qrcode.react";
import { getSocket } from "@/lib/socket";
import { soundEngine } from "@/lib/sound-effects";
import { karaokeAudio } from "@/lib/karaoke-audio-processor";
import {
  QueueItem,
  RoomState,
  SyncStatePayload,
  ControlAction,
  CheerType,
  FloatingCheer,
  DanmakuMessage,
} from "@/types/socket";
import {
  Tv,
  Smartphone,
  Wifi,
  WifiOff,
  Copy,
  Check,
  ExternalLink,
  Users,
  Mic2,
  Maximize2,
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Music,
  Play,
  Pause,
  SkipForward,
  Bell,
  Heart,
  Flame,
  PartyPopper,
  PlusCircle,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";

// Dynamically import react-youtube to avoid SSR issues
const YouTube = dynamic(() => import("react-youtube"), { ssr: false });

interface HostPageProps {
  params: Promise<{
    roomId: string;
  }>;
}

export default function HostRoomPage({ params }: HostPageProps) {
  const resolvedParams = use(params);
  const rawRoomId = resolvedParams.roomId;
  const roomId = rawRoomId ? rawRoomId.toUpperCase() : "";

  // Socket & Room States
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [currentSong, setCurrentSong] = useState<QueueItem | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [controllersCount, setControllersCount] = useState<number>(0);
  const [controllerList, setControllerList] = useState<string[]>([]);
  const [controllerUrl, setControllerUrl] = useState<string>("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [hostPin, setHostPin] = useState<string>("");
  const [showPin, setShowPin] = useState<boolean>(false);

  // Playback Progress States
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Audio Processing states (Vocal Splitter & Key Transpose)
  const [isVocalMuted, setIsVocalMuted] = useState<boolean>(false);
  const [pitchShift, setPitchShift] = useState<number>(0);

  // Floating Cheers particles
  const [cheers, setCheers] = useState<FloatingCheer[]>([]);

  // Danmaku Barrage Running Text
  const [danmakuList, setDanmakuList] = useState<DanmakuMessage[]>([]);
  const laneIndexRef = useRef<number>(0);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentSongRef = useRef<QueueItem | null>(null);
  currentSongRef.current = currentSong;
  const lastTimeUpdateSentRef = useRef<number>(0);

  // Mobile-friendly LAN URL detection
  useEffect(() => {
    if (typeof window !== "undefined" && roomId) {
      const defaultUrl = `${window.location.origin}/room/${roomId}/controller`;
      setControllerUrl(defaultUrl);

      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        fetch("/api/server-info")
          .then((res) => res.json())
          .then((data) => {
            if (data?.publicUrl) {
              setControllerUrl(`${data.publicUrl}/room/${roomId}/controller`);
            } else if (data?.lanIp && data.lanIp !== "127.0.0.1") {
              const lanUrl = `http://${data.lanIp}:${window.location.port || 3000}/room/${roomId}/controller`;
              setControllerUrl(lanUrl);
            }
          })
          .catch(() => {});
      }
    }
  }, [roomId]);

  // Handle Song Ended -> request next song from queue
  const handleSongEnded = useCallback(() => {
    console.log(`[Host] Video ended for song: ${currentSong?.title}`);
    const socket = getSocket();
    socket.emit("client:song-ended", { roomId });
    setCurrentTime(0);
    setDuration(0);
  }, [roomId, currentSong?.title]);

  // Trigger floating cheer animation and sound
  const triggerCheerEffect = useCallback((type: CheerType = "applause") => {
    // 1. Play synthesized sound effect
    soundEngine.play(type);

    // 2. Spawn 5-8 floating emojis
    const emojiMap: Record<CheerType, string[]> = {
      applause: ["👏", "🙌", "✨", "👏", "👏"],
      whistle: ["📣", "⚡", "🎉", "🔥", "💨"],
      cheer: ["🥳", "🎉", "🎤", "⭐", "🎊"],
      heart: ["💖", "❤️", "🥰", "💕", "✨"],
      fire: ["🔥", "💥", "⚡", "🌟", "🔥"],
    };

    const emojis = emojiMap[type] || emojiMap.applause;
    const newItems: FloatingCheer[] = emojis.map((emoji) => ({
      id: Math.random().toString(36).substring(2, 9),
      emoji,
      type,
      left: Math.floor(10 + Math.random() * 80), // 10% to 90%
      animationDuration: 2.5 + Math.random() * 1.5,
    }));

    setCheers((prev) => [...prev, ...newItems]);

    // Clean up after animation finishes
    setTimeout(() => {
      setCheers((prev) => prev.filter((c) => !newItems.some((n) => n.id === c.id)));
    }, 4000);
  }, []);

  // Trigger Danmaku Running Text across screen (from right to left)
  const triggerDanmakuText = useCallback((text: string, sender: string) => {
    const lanes = [10, 18, 26, 34, 42, 50, 58];
    const colors = [
      "#FFE600", // Neon Yellow
      "#00FFFF", // Cyan
      "#FF1493", // Hot Pink
      "#00FF7F", // Neon Green
      "#FFFFFF", // White
      "#FF9900", // Vivid Orange
      "#DA70D6", // Orchid
    ];

    const topPercent = lanes[laneIndexRef.current % lanes.length];
    const color = colors[Math.floor(Math.random() * colors.length)];
    laneIndexRef.current += 1;

    const durationSec = 7 + Math.random() * 2; // 7-9 seconds
    const newDanmaku: DanmakuMessage = {
      id: Math.random().toString(36).substring(2, 9),
      text,
      sender: sender || "Khách",
      color,
      topPercent,
      durationSec,
      createdAt: Date.now(),
    };

    setDanmakuList((prev) => [...prev, newDanmaku]);

    // Clean up after scroll finishes
    setTimeout(() => {
      setDanmakuList((prev) => prev.filter((d) => d.id !== newDanmaku.id));
    }, (durationSec + 0.5) * 1000);
  }, []);

  // Trigger specific Emoji floating from bottom to top
  const triggerEmojiReaction = useCallback((emoji: string) => {
    // Generate 6-8 floating particles of this emoji
    const newParticles: FloatingCheer[] = Array.from({ length: 6 }).map(() => ({
      id: Math.random().toString(36).substring(2, 9),
      emoji,
      type: "emoji",
      left: Math.floor(8 + Math.random() * 84),
      animationDuration: 2.8 + Math.random() * 1.6,
    }));

    setCheers((prev) => [...prev, ...newParticles]);
    soundEngine.play("applause");

    setTimeout(() => {
      setCheers((prev) => prev.filter((c) => !newParticles.some((n) => n.id === c.id)));
    }, 4500);
  }, []);

  // Connect to Socket as HOST & Listen to events
  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();

    const joinAsHost = () => {
      console.log(`[Host] Joining room ${roomId} as HOST...`);
      socket.emit("client:join-room", {
        roomId,
        role: "host",
        nickname: "TV Screen Host",
      });
    };

    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id || "");
      joinAsHost();
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onRoomJoined(res: { success: boolean; room: RoomState; role: string; hostPin?: string }) {
      if (res.success && res.room) {
        setRoomState(res.room);
        if (res.hostPin) {
          setHostPin(res.hostPin);
        } else if (res.room.hostPin) {
          setHostPin(res.room.hostPin);
        }
        setCurrentSong(res.room.currentSong);
        setQueue(res.room.queue);
        setIsPlaying(res.room.isPlaying);
        setControllersCount(res.room.controllers.length);
        setControllerList(res.room.controllers);

        if (typeof res.room.vocalMuted === "boolean") {
          setIsVocalMuted(res.room.vocalMuted);
          if (karaokeAudio) karaokeAudio.setVocalMuted(res.room.vocalMuted);
        }
        if (typeof res.room.pitchShift === "number") {
          setPitchShift(res.room.pitchShift);
          if (karaokeAudio) karaokeAudio.setPitch(res.room.pitchShift);
        }
      }
    }

    // Real-time synchronization
    function onSyncState(payload: SyncStatePayload) {
      if (payload.roomId === roomId) {
        setCurrentSong(payload.currentSong);
        setQueue(payload.queue || []);
        setIsPlaying(payload.isPlaying);
        setControllersCount(payload.controllersCount);
        setControllerList(payload.controllers || []);

        if (typeof payload.vocalMuted === "boolean") {
          setIsVocalMuted(payload.vocalMuted);
          if (karaokeAudio) karaokeAudio.setVocalMuted(payload.vocalMuted);
        }
        if (typeof payload.pitchShift === "number") {
          setPitchShift(payload.pitchShift);
          if (karaokeAudio) karaokeAudio.setPitch(payload.pitchShift);
        }
      }
    }

    function onRoomUpdated(data: { roomId: string; room: RoomState | null }) {
      if (data.roomId === roomId && data.room) {
        setRoomState(data.room);
        if (data.room.hostPin) {
          setHostPin(data.room.hostPin);
        }
        setCurrentSong(data.room.currentSong);
        setQueue(data.room.queue);
        setIsPlaying(data.room.isPlaying);
        setControllersCount(data.room.controllers.length);
        setControllerList(data.room.controllers);

        if (typeof data.room.vocalMuted === "boolean") {
          setIsVocalMuted(data.room.vocalMuted);
          if (karaokeAudio) karaokeAudio.setVocalMuted(data.room.vocalMuted);
        }
        if (typeof data.room.pitchShift === "number") {
          setPitchShift(data.room.pitchShift);
          if (karaokeAudio) karaokeAudio.setPitch(data.room.pitchShift);
        }
      }
    }

    // Direct playback commands from Controller (play / pause / skip / volume)
    function onHostControl(cmd: { action: ControlAction; value?: any }) {
      console.log(`[Host] Received control command:`, cmd);
      if (cmd.action === "play") {
        setIsPlaying(true);
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
        if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === "function") {
          ytPlayerRef.current.playVideo();
        }
      } else if (cmd.action === "pause") {
        setIsPlaying(false);
        if (videoRef.current) {
          videoRef.current.pause();
        }
        if (ytPlayerRef.current && typeof ytPlayerRef.current.pauseVideo === "function") {
          ytPlayerRef.current.pauseVideo();
        }
      } else if (cmd.action === "skip") {
        handleSongEnded();
      } else if (cmd.action === "volume" && typeof cmd.value === "number") {
        if (videoRef.current) {
          videoRef.current.volume = cmd.value / 100;
        }
        if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === "function") {
          ytPlayerRef.current.setVolume(cmd.value);
        }
        if (karaokeAudio) {
          karaokeAudio.setVolume(cmd.value / 100);
        }
      } else if (cmd.action === "mute-vocal") {
        setIsVocalMuted(true);
        if (karaokeAudio) karaokeAudio.setVocalMuted(true);
      } else if (cmd.action === "unmute-vocal") {
        setIsVocalMuted(false);
        if (karaokeAudio) karaokeAudio.setVocalMuted(false);
      } else if (cmd.action === "toggle-vocal") {
        setIsVocalMuted((prev) => {
          const next = !prev;
          if (karaokeAudio) karaokeAudio.setVocalMuted(next);
          return next;
        });
      } else if (cmd.action === "set-pitch" && typeof cmd.value === "number") {
        setPitchShift(cmd.value);
        if (karaokeAudio) karaokeAudio.setPitch(cmd.value);
      } else if (cmd.action === "pitch-up") {
        setPitchShift((prev) => {
          const next = Math.min(4, prev + 1);
          if (karaokeAudio) karaokeAudio.setPitch(next);
          return next;
        });
      } else if (cmd.action === "pitch-down") {
        setPitchShift((prev) => {
          const next = Math.max(-4, prev - 1);
          if (karaokeAudio) karaokeAudio.setPitch(next);
          return next;
        });
      } else if (cmd.action === "pitch-reset") {
        setPitchShift(0);
        if (karaokeAudio) karaokeAudio.setPitch(0);
      }
    }

    // Real-time Cheer Effect from Controller
    function onCheerEffect(data: { type: CheerType; sender?: string }) {
      console.log(`[Host] Received cheer effect:`, data);
      triggerCheerEffect(data.type || "applause");
    }

    // Live Reactions & Danmaku Barrage
    function onServerReaction(data: { type: "text" | "emoji"; content: string; senderName?: string }) {
      console.log(`[Host] Received reaction:`, data);
      if (data.type === "text") {
        triggerDanmakuText(data.content, data.senderName || "Khách");
      } else {
        triggerEmojiReaction(data.content);
      }
    }

    // Remote Seek Command from Controller
    function onClientSeekTo(payload: { roomId: string; targetTime: number }) {
      if (payload.roomId === roomId && typeof payload.targetTime === "number") {
        const target = Math.max(0, payload.targetTime);
        console.log(`[Host] Received seek command: seek to ${target}s`);
        setCurrentTime(target);

        if (currentSongRef.current?.source === "local" && videoRef.current) {
          videoRef.current.currentTime = target;
        } else if (currentSongRef.current?.source === "youtube" && ytPlayerRef.current) {
          if (typeof ytPlayerRef.current.seekTo === "function") {
            ytPlayerRef.current.seekTo(target, true);
          }
        }
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-joined", onRoomJoined);
    socket.on("server:sync-state", onSyncState);
    socket.on("room-updated", onRoomUpdated);
    socket.on("host:control", onHostControl);
    socket.on("server:cheer-effect", onCheerEffect);
    socket.on("server:reaction", onServerReaction);
    socket.on("client:seek-to", onClientSeekTo);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-joined", onRoomJoined);
      socket.off("server:sync-state", onSyncState);
      socket.off("room-updated", onRoomUpdated);
      socket.off("host:control", onHostControl);
      socket.off("server:cheer-effect", onCheerEffect);
      socket.off("server:reaction", onServerReaction);
      socket.off("client:seek-to", onClientSeekTo);
    };
  }, [roomId, handleSongEnded, triggerCheerEffect, triggerDanmakuText, triggerEmojiReaction]);

  // YouTube polling for currentTime & duration + broadcast host:time-update
  useEffect(() => {
    if (currentSong?.source === "youtube") {
      progressTimerRef.current = setInterval(() => {
        if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === "function") {
          const curr = ytPlayerRef.current.getCurrentTime() || 0;
          const dur = ytPlayerRef.current.getDuration() || currentSong.duration || 0;
          setCurrentTime(curr);
          if (dur > 0) setDuration(dur);

          // Broadcast time update to controllers in room
          const socket = getSocket();
          socket.emit("host:time-update", {
            roomId,
            currentTime: curr,
            duration: dur,
          });
        }
      }, 500);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    }

    return () => {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [currentSong, roomId]);

  // Calculate if remaining time is <= 20 seconds
  const remainingTime = duration > 0 ? Math.max(0, duration - currentTime) : 999;
  const isLast20Seconds = duration > 0 && remainingTime <= 20;
  const nextSong = queue.length > 0 ? queue[0] : null;

  // Fullscreen helper
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const copyToClipboard = (text: string, type: "pin" | "url") => {
    navigator.clipboard.writeText(text);
    if (type === "pin") {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  // Helper to add sample songs for rapid testing directly on Host
  const addSampleSong = (sampleType: "youtube" | "local") => {
    const socket = getSocket();
    const sampleItem: QueueItem =
      sampleType === "youtube"
        ? {
            id: `yt-${Date.now()}`,
            title: "Nơi Này Có Anh (Beat Chuẩn)",
            artist: "Sơn Tùng M-TP",
            duration: 260,
            source: "youtube",
            youtubeId: "fn3KWM1kuAw", // Sample YouTube video ID
            requestedBy: "Khách VIP",
          }
        : {
            id: `loc-${Date.now()}`,
            title: "Big Buck Bunny (Video Mẫu Local)",
            artist: "Open Source Audio",
            duration: 60,
            source: "local",
            url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
            requestedBy: "Hệ thống",
          };

    socket.emit("client:add-queue", {
      roomId,
      item: sampleItem,
    });
  };

  return (
    <div className="relative w-screen h-screen bg-black text-white font-sans overflow-hidden select-none flex items-center justify-center">
      {/* =========================================================================
          1. VIDEO PLAYER CONTAINER (16:9 or Full-screen Letterbox)
         ========================================================================= */}
      <div className="relative w-full h-full aspect-video max-w-full max-h-screen bg-black flex items-center justify-center overflow-hidden">
        {/* CASE A: Song is Playing */}
        {currentSong ? (
          <div className="relative w-full h-full flex items-center justify-center">
            {/* 1. LOCAL HTML5 VIDEO WITH WEB AUDIO API PROCESSOR */}
            {currentSong.source === "local" && (
              <video
                ref={videoRef}
                src={currentSong.url}
                autoPlay
                playsInline
                crossOrigin="anonymous"
                controls={false}
                onEnded={handleSongEnded}
                onTimeUpdate={(e) => {
                  const target = e.currentTarget;
                  const curr = target.currentTime;
                  const dur = target.duration || duration || 0;
                  setCurrentTime(curr);
                  if (target.duration) setDuration(target.duration);

                  // Throttle socket event to maximum once every 500ms
                  const now = Date.now();
                  if (now - lastTimeUpdateSentRef.current >= 500) {
                    lastTimeUpdateSentRef.current = now;
                    const socket = getSocket();
                    socket.emit("host:time-update", {
                      roomId,
                      currentTime: curr,
                      duration: dur,
                    });
                  }
                }}
                onLoadedMetadata={(e) => {
                  const target = e.currentTarget;
                  const dur = target.duration || 0;
                  setDuration(dur);
                  if (isPlaying) target.play().catch(() => {});
                  if (karaokeAudio) {
                    karaokeAudio.attachMediaElement(target);
                    karaokeAudio.setVocalMuted(isVocalMuted);
                    karaokeAudio.setPitch(pitchShift);
                  }

                  const socket = getSocket();
                  socket.emit("host:time-update", {
                    roomId,
                    currentTime: target.currentTime || 0,
                    duration: dur,
                  });
                }}
                onPlay={(e) => {
                  if (karaokeAudio) {
                    karaokeAudio.resume();
                    karaokeAudio.attachMediaElement(e.currentTarget);
                  }
                }}
                className="w-full h-full object-contain pointer-events-none"
              />
            )}

            {/* 2. YOUTUBE IFRAME PLAYER */}
            {currentSong.source === "youtube" && currentSong.youtubeId && (
              <div className="w-full h-full pointer-events-none scale-[1.02]">
                <YouTube
                  videoId={currentSong.youtubeId}
                  opts={{
                    width: "100%",
                    height: "100%",
                    playerVars: {
                      autoplay: 1,
                      controls: 0,
                      disablekb: 1,
                      modestbranding: 1,
                      rel: 0,
                      showinfo: 0,
                      iv_load_policy: 3,
                      fs: 0,
                    },
                  }}
                  onReady={(event) => {
                    ytPlayerRef.current = event.target;
                    event.target.playVideo();
                    setDuration(event.target.getDuration() || currentSong.duration);
                  }}
                  onEnd={handleSongEnded}
                  onError={(err) => {
                    console.error("[Host] YouTube playback error:", err);
                    handleSongEnded();
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* PAUSED BANNER OVERLAY */}
            {!isPlaying && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
                <div className="p-5 bg-rose-600/90 rounded-full text-white shadow-2xl animate-pulse">
                  <Pause className="w-12 h-12" />
                </div>
                <div className="text-2xl font-bold tracking-wider text-rose-300 uppercase">
                  ĐANG TẠM DỪNG
                </div>
                <div className="text-sm text-slate-300">
                  Điều khiển tiếp tục phát từ điện thoại Controller
                </div>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             CASE B: STANDBY SCREEN (Màn hình chờ khi danh sách bài trống)
             ========================================================================= */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 md:p-12 text-center relative z-10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
            {/* Ambient Stage Lights */}
            <div className="absolute top-1/4 left-1/3 w-[600px] h-[350px] bg-rose-600/15 rounded-full blur-[130px] animate-pulse pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/3 w-[600px] h-[350px] bg-purple-600/15 rounded-full blur-[130px] pointer-events-none" />

            <div className="max-w-4xl mx-auto space-y-6 flex flex-col items-center">
              {/* Standby Header Badge */}
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-semibold text-rose-300 tracking-wider shadow-lg">
                <Sparkles className="w-4 h-4 text-rose-400" />
                <span>CHẾ ĐỘ CHỜ • PHÒNG ĐÃ SẴN SÀNG</span>
              </div>

              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white">
                Sân Khấu Karaoke Thông Minh
              </h1>
              <p className="text-slate-400 text-sm md:text-base max-w-xl">
                Quét mã QR dưới đây bằng điện thoại để tìm bài hát, thêm vào hàng đợi và điều khiển phát nhạc.
              </p>

              {/* QR Showcase Card */}
              <div className="flex flex-col sm:flex-row items-center gap-8 p-6 md:p-8 bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl backdrop-blur-xl">
                {/* QR Code Container */}
                <div className="p-4 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center shrink-0">
                  {controllerUrl ? (
                    <QRCodeSVG value={controllerUrl} size={180} level="H" includeMargin={false} />
                  ) : (
                    <div className="w-[180px] h-[180px] flex items-center justify-center text-slate-800 text-xs">
                      Đang tạo mã QR...
                    </div>
                  )}
                  <div className="mt-2 text-[10px] font-black uppercase tracking-wider text-slate-900">
                    Camera Quét Mã
                  </div>
                </div>

                {/* Instructions & Room Details */}
                <div className="text-left space-y-4 max-w-xs">
                  <div>
                    <div className="text-[11px] text-slate-400 uppercase tracking-widest font-semibold">
                      Mã Phòng Hát:
                    </div>
                    <div className="text-3xl font-black font-mono tracking-widest text-transparent bg-gradient-to-r from-rose-400 via-purple-300 to-cyan-300 bg-clip-text">
                      {roomId}
                    </div>
                  </div>

                  {/* Admin PIN Box */}
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-950/40 border border-amber-500/40 rounded-xl text-xs">
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-slate-400 font-medium">PIN Quản Trị:</span>
                      <span className="font-mono font-bold text-amber-300 tracking-widest text-sm">
                        {showPin ? hostPin || "----" : "••••"}
                      </span>
                      <button
                        onClick={() => setShowPin(!showPin)}
                        className="ml-1 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer rounded-md hover:bg-slate-800/80"
                        title={showPin ? "Ẩn mã PIN" : "Hiện mã PIN quản trị"}
                      >
                        {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 leading-relaxed">
                    Mở trình duyệt hoặc ứng dụng camera trên điện thoại, quét mã QR trên để vào thẳng giao diện chọn bài.
                  </div>

                  {/* Connected Controllers Counter */}
                  <div className="pt-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Smartphone className="w-4 h-4 text-rose-400" />
                    <span>
                      Điện thoại kết nối:{" "}
                      <b className="text-emerald-400 font-mono text-sm">{controllersCount}</b> thiết bị
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Sample Song Injector for Easy Testing */}
              <div className="pt-2 flex items-center gap-3">
                <span className="text-xs text-slate-400">Chọn thử bài để test:</span>
                <button
                  onClick={() => addSampleSong("youtube")}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Test Bài YouTube</span>
                </button>
                <button
                  onClick={() => addSampleSong("local")}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Test Video Local</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            2. TOP OVERLAY (Mã phòng + Admin PIN + Tên bài đang phát + Controllers count)
           ========================================================================= */}
        <div className="absolute top-0 left-0 right-0 p-6 flex items-start justify-between z-20 pointer-events-none bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          {/* Top Left: Room Code & Admin PIN & Status */}
          <div className="flex items-center gap-2.5 pointer-events-auto">
            <div className="flex items-center gap-2 bg-slate-950/85 border border-slate-800/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl text-xs font-semibold">
              <span className="text-slate-400">PHÒNG:</span>
              <span className="font-mono text-base font-black tracking-widest text-rose-400">
                {roomId}
              </span>
            </div>

            {/* Admin PIN Pill with Eye Toggle */}
            <div className="flex items-center gap-1.5 bg-slate-950/85 border border-amber-900/50 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs shadow-lg shadow-amber-950/20">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400 text-[11px] font-medium">PIN:</span>
              <span className="font-mono font-bold text-amber-300 tracking-widest text-sm">
                {showPin ? hostPin || "----" : "••••"}
              </span>
              <button
                onClick={() => setShowPin(!showPin)}
                className="ml-1 p-0.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={showPin ? "Ẩn mã PIN" : "Hiện mã PIN quản trị"}
              >
                {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/85 border border-slate-800/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs">
              <Smartphone className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-mono font-bold text-white">{controllersCount}</span>
              <span className="text-slate-400 text-[11px]">điện thoại</span>
            </div>
          </div>

          {/* Top Center / Right: Current Playing Song Banner + Audio Status */}
          {currentSong && (
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-950/85 border border-slate-800/90 backdrop-blur-xl px-5 py-2.5 rounded-2xl shadow-2xl pointer-events-auto max-w-xl">
              <div className="flex items-center gap-3 overflow-hidden flex-1">
                <div className="p-2 bg-gradient-to-tr from-rose-500 to-purple-600 rounded-xl text-white shadow-lg shadow-rose-500/20 shrink-0">
                  <Music className="w-5 h-5 animate-spin" style={{ animationDuration: "8s" }} />
                </div>
                <div className="text-left overflow-hidden">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                      ĐANG PHÁT {currentSong.source === "local" && "• LOCAL BEAT"}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                    {currentSong.title}
                  </div>
                  <div className="text-xs text-slate-400 truncate">
                    {currentSong.artist} •{" "}
                    <span className="text-purple-300">Yêu cầu bởi {currentSong.requestedBy}</span>
                  </div>
                </div>
              </div>

              {/* Audio DSP Badges (Tone & Vocal Splitter) */}
              <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 sm:border-l border-slate-800/80 sm:pl-3">
                <div
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold border transition-all ${
                    pitchShift === 0
                      ? "bg-slate-900 border-slate-700 text-slate-300"
                      : "bg-purple-950/80 border-purple-500/60 text-purple-300 shadow-lg shadow-purple-900/30 animate-pulse"
                  }`}
                  title="Cao độ bài hát (Tone semitones)"
                >
                  Tone: {pitchShift === 0 ? "Gốc" : pitchShift > 0 ? `+${pitchShift}` : pitchShift}
                </div>

                <div
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all ${
                    isVocalMuted
                      ? "bg-amber-950/80 border-amber-500/60 text-amber-300 shadow-lg shadow-amber-900/30"
                      : "bg-emerald-950/80 border-emerald-500/60 text-emerald-300"
                  }`}
                  title="Trạng thái giọng ca sĩ (Stereo Splitter)"
                >
                  {isVocalMuted ? "🎧 Tắt ca sĩ (Beat)" : "🎤 Bật ca sĩ"}
                </div>
              </div>
            </div>
          )}

          {/* Top Far Right: Fullscreen Button */}
          <div className="pointer-events-auto">
            <button
              onClick={toggleFullScreen}
              className="p-2.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800/80 rounded-xl text-slate-300 hover:text-white transition-all cursor-pointer backdrop-blur-md"
              title="Toàn màn hình TV"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            3. BOTTOM OVERLAY: Upcoming Next Song (20s countdown) & Progress Bar
           ========================================================================= */}
        {currentSong && (
          <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-3 z-20 pointer-events-none bg-gradient-to-t from-black/90 via-black/40 to-transparent">
            {/* NEXT SONG BANNER (Triggered when remainingTime <= 20s) */}
            {isLast20Seconds && nextSong && (
              <div className="self-start pointer-events-auto animate-bounce transition-all duration-500">
                <div className="flex items-center gap-3.5 px-6 py-3.5 bg-gradient-to-r from-purple-900/90 via-slate-900/95 to-rose-900/90 border border-purple-500/40 rounded-2xl shadow-2xl backdrop-blur-2xl">
                  <div className="p-2 bg-purple-600 rounded-xl text-white shadow-lg animate-pulse">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-purple-300">
                      <span>BÀI TIẾP THEO (Còn {Math.round(remainingTime)}s)</span>
                    </div>
                    <div className="text-base font-extrabold text-white">
                      {nextSong.title} - {nextSong.artist}
                    </div>
                    <div className="text-xs text-rose-300">
                      Do <b>{nextSong.requestedBy}</b> yêu cầu
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Song Duration / Progress Bar */}
            <div className="w-full flex items-center gap-3 text-xs font-mono text-slate-400 pointer-events-none">
              <span>{formatSeconds(currentTime)}</span>
              <div className="flex-1 h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-500 to-purple-500 transition-all duration-300"
                  style={{
                    width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  }}
                />
              </div>
              <span>{formatSeconds(duration)}</span>
            </div>
          </div>
        )}

        {/* =========================================================================
            4. DANMAKU BARRAGE LAYER (Running text from right to left across screen)
           ========================================================================= */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
          {danmakuList.map((item) => (
            <div
              key={item.id}
              className="absolute whitespace-nowrap animate-danmaku font-black text-2xl md:text-4xl tracking-wide danmaku-text select-none flex items-center gap-2"
              style={{
                top: `${item.topPercent}%`,
                animationDuration: `${item.durationSec}s`,
                color: item.color,
              }}
            >
              <span className="text-[11px] bg-black/75 text-white px-2.5 py-0.5 rounded-full border border-white/30 font-semibold shadow-md">
                {item.sender}
              </span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* =========================================================================
            5. FLOATING EMOJI PARTICLES (Animation when Controller sends Emoji/Cheer)
           ========================================================================= */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
          {cheers.map((item) => (
            <div
              key={item.id}
              className="absolute bottom-6 animate-float-up text-5xl md:text-6xl drop-shadow-2xl select-none"
              style={{
                left: `${item.left}%`,
                animationDuration: `${item.animationDuration}s`,
                // Randomized rotation for realistic drifting
                ["--rot" as any]: `${(item.left % 20) - 10}deg`,
              }}
            >
              {item.emoji}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatSeconds(sec: number): string {
  if (isNaN(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}
