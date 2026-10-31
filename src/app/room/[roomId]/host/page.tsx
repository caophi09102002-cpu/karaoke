"use client";

import React, { useEffect, useState, useRef, useCallback, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Trophy,
  Award,
  ArrowRight,
  LogOut,
  AlertTriangle,
} from "lucide-react";

// Dynamically import react-youtube to avoid SSR issues
const YouTube = dynamic(() => import("react-youtube"), { ssr: false });

const SCORING_TITLES = [
  "👑 Giọng Ca Vàng Trong Làng Giải Trí",
  "🔥 Hát Cháy Cả Loa, Hàng Xóm Phải Tới Khen",
  "💿 Hát Như Nuốt Đĩa, Chuẩn Từng Nốt Nhạc",
  "⭐ Ca Sĩ Triển Vọng Của Xóm",
  "🎤 Giọng Ca Oanh Vàng, Chim Nghe Đều Thao Thức",
  "🍻 Hát Rất Đam Mê, Cho 10 Điểm Tinh Thần",
  "👏 Đỉnh Cao Phong Độ, Nhận Tràng Pháo Tay",
  "🚀 Nốt Cao Xuyên Lục Địa, Quá Đỉnh",
  "💯 Idol Giới Trẻ, Giọng Ca Triệu View",
  "🌟 Giọng Hát Ngọt Ngào, Rung Động Triệu Con Tim",
];

interface HostPageProps {
  params: Promise<{
    roomId: string;
  }>;
}

function HostRoomContent({ params }: HostPageProps) {
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

  // Karaoke Scoring & Smooth Fade-out States
  const [scoreData, setScoreData] = useState<{
    score: number;
    displayScore: number;
    title: string;
    songTitle: string;
    singerName: string;
    countdown: number;
  } | null>(null);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const scoreIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Close Room State
  const router = useRouter();
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);
  const [isClosingRoom, setIsClosingRoom] = useState<boolean>(false);

  // Handle Close Room (Host confirms end of karaoke party)
  const handleCloseRoom = useCallback(() => {
    setIsClosingRoom(true);
    const socket = getSocket();
    socket.emit("client:close-room", { roomId, pin: hostPin }, (res: any) => {
      try {
        localStorage.removeItem("karaoke_last_room_id");
        localStorage.removeItem(`karaoke_admin_pin_${roomId}`);
      } catch (e) {}
      router.push("/");
    });
  }, [roomId, hostPin, router]);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const ytPlayerRef = useRef<any>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const currentSongRef = useRef<QueueItem | null>(null);
  currentSongRef.current = currentSong;
  const lastTimeUpdateSentRef = useRef<number>(0);
  const initialSeekTimeRef = useRef<number>(0);

  // Guard against duplicate song end / scoring triggers
  const isEndingSongRef = useRef<boolean>(false);
  const activeSongIdRef = useRef<string | null>(null);

  // Reset song end guard when new song is loaded
  useEffect(() => {
    if (currentSong?.id !== activeSongIdRef.current) {
      activeSongIdRef.current = currentSong?.id || null;
      isEndingSongRef.current = false;
    }
  }, [currentSong?.id]);

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

  // Show scoring celebration and then trigger next song
  const showScoringAndEnd = useCallback((finishedSong: QueueItem | null) => {
    // Immediately stop ongoing video playback to prevent any background loop
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === "function") {
      ytPlayerRef.current.stopVideo();
    }

    if (!finishedSong) {
      const socket = getSocket();
      socket.emit("client:song-ended", { roomId });
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const isPerfect = Math.random() < 0.06;
    const finalScore = isPerfect ? 100 : Math.floor(86 + Math.random() * 13);
    const randomTitle = SCORING_TITLES[Math.floor(Math.random() * SCORING_TITLES.length)];

    // Play fanfare and applause
    soundEngine.playCheer();

    setScoreData({
      score: finalScore,
      displayScore: 0,
      title: randomTitle,
      songTitle: finishedSong.title,
      singerName: finishedSong.requestedBy || "Ca sĩ bí ẩn",
      countdown: 6,
    });

    // Score roll up animation from 0 to finalScore
    let currentVal = 0;
    const step = Math.ceil(finalScore / 25);
    const rollInterval = setInterval(() => {
      currentVal += step;
      if (currentVal >= finalScore) {
        currentVal = finalScore;
        clearInterval(rollInterval);
      }
      setScoreData((prev) => (prev ? { ...prev, displayScore: currentVal } : null));
    }, 35);

    // Countdown 6 seconds before advancing
    let remaining = 6;
    if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current);
    scoreIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setScoreData((prev) => (prev ? { ...prev, countdown: remaining } : null));
      if (remaining <= 0) {
        if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current);
        setScoreData(null);
        setIsFadingOut(false);
        const socket = getSocket();
        socket.emit("client:song-ended", { roomId });
        setCurrentTime(0);
        setDuration(0);
      }
    }, 1000);
  }, [roomId]);

  // Fast skip scoring screen
  const skipScoringNow = useCallback(() => {
    if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current);
    setScoreData(null);
    setIsFadingOut(false);
    const socket = getSocket();
    socket.emit("client:song-ended", { roomId });
    setCurrentTime(0);
    setDuration(0);
  }, [roomId]);

  // Perform smooth volume fade out over 1.5s then trigger scoring
  const performFadeOutAndEnd = useCallback(() => {
    if (isFadingOut) return;
    setIsFadingOut(true);

    // Play gentle applause as fadeout begins
    soundEngine.playApplause(2.0);

    let steps = 15;
    const stepInterval = 100;
    const initialVol = videoRef.current ? videoRef.current.volume : 1;

    const fadeTimer = setInterval(() => {
      steps -= 1;
      const factor = Math.max(0, steps / 15);
      if (videoRef.current) {
        videoRef.current.volume = initialVol * factor;
      }
      if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === "function") {
        ytPlayerRef.current.setVolume(Math.round(100 * factor));
      }

      if (steps <= 0) {
        clearInterval(fadeTimer);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.volume = 1;
        }
        if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === "function") {
          ytPlayerRef.current.stopVideo();
          ytPlayerRef.current.setVolume(100);
        }
        showScoringAndEnd(currentSongRef.current);
      }
    }, stepInterval);
  }, [isFadingOut, showScoringAndEnd]);

  // Natural song end (trigger scoring then advance)
  const handleSongEnded = useCallback(() => {
    if (isEndingSongRef.current) {
      console.log("[Host] Song end already in progress, ignoring duplicate trigger");
      return;
    }
    isEndingSongRef.current = true;
    console.log(`[Host] Video ended naturally for: ${currentSongRef.current?.title}`);
    showScoringAndEnd(currentSongRef.current);
  }, [showScoringAndEnd]);

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

        if (typeof res.room.currentTime === "number" && res.room.currentTime > 0) {
          initialSeekTimeRef.current = res.room.currentTime;
          setCurrentTime(res.room.currentTime);
        }

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
        console.log("[Host] Song skipped by controller - NO SCORING");
        if (scoreIntervalRef.current) clearInterval(scoreIntervalRef.current);
        setScoreData(null);
        setIsFadingOut(false);
        isEndingSongRef.current = false;
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
        if (ytPlayerRef.current && typeof ytPlayerRef.current.stopVideo === "function") {
          ytPlayerRef.current.stopVideo();
        }
        // Do NOT emit client:song-ended here because server already called nextSong()!
        setCurrentTime(0);
        setDuration(0);
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
                key={currentSong.id || currentSong.url}
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
                  key={currentSong.id || currentSong.youtubeId}
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
                    if (initialSeekTimeRef.current > 3) {
                      console.log(`[Host] Restoring playback time to: ${initialSeekTimeRef.current}s`);
                      event.target.seekTo(initialSeekTimeRef.current, true);
                    }
                    setDuration(event.target.getDuration() || currentSong.duration);
                  }}
                  onEnd={handleSongEnded}
                  onError={(err) => {
                    console.error("[Host] YouTube playback error:", err);
                    if (!isEndingSongRef.current) {
                      handleSongEnded();
                    }
                  }}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* PAUSED BANNER OVERLAY - CLICKABLE TO RESUME PLAYBACK */}
            {!isPlaying && (
              <div
                onClick={() => {
                  setIsPlaying(true);
                  if (videoRef.current) videoRef.current.play().catch(() => {});
                  if (ytPlayerRef.current && typeof ytPlayerRef.current.playVideo === "function") {
                    ytPlayerRef.current.playVideo();
                  }
                  const socket = getSocket();
                  socket.emit("client:control", { roomId, action: "play" });
                }}
                className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center gap-4 z-30 cursor-pointer group transition-all"
                title="Bấm để tiếp tục phát"
              >
                <div className="w-20 h-20 rounded-full bg-white/10 group-hover:bg-white/20 border border-white/20 flex items-center justify-center text-white shadow-2xl transition-all group-hover:scale-105">
                  <Play className="w-8 h-8 fill-white translate-x-0.5" />
                </div>
                <div className="text-lg font-semibold text-white tracking-tight">
                  Tạm dừng bài hát
                </div>
                <div className="text-xs text-zinc-400">
                  Chạm vào màn hình hoặc điều khiển trên điện thoại để tiếp tục
                </div>
              </div>
            )}
          </div>
        ) : (
          /* =========================================================================
             CASE B: STANDBY SCREEN (Sân khấu chờ sang trọng & tối giản)
             ========================================================================= */
          <div className="w-full h-full flex flex-col items-center justify-center p-6 md:p-12 text-center relative z-10 bg-[#09090b]">
            {/* Subtle Warm Stage Lighting */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-amber-500/[0.05] rounded-full blur-[140px] pointer-events-none" />

            <div className="max-w-2xl mx-auto space-y-8 flex flex-col items-center relative z-10">
              {/* Brand Indicator */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-zinc-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Sân khấu đang sẵn sàng</span>
              </div>

              {/* QR Showcase Card - Double Bezel Luxury Container */}
              <div className="p-2 rounded-3xl bg-zinc-900/60 border border-white/[0.08] shadow-2xl backdrop-blur-xl">
                <div className="p-6 md:p-8 rounded-[1.25rem] bg-zinc-950/90 border border-white/[0.04] flex flex-col sm:flex-row items-center gap-8">
                  {/* QR Code Container */}
                  <div className="p-3.5 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center shrink-0">
                    {controllerUrl ? (
                      <QRCodeSVG value={controllerUrl} size={180} level="H" includeMargin={false} />
                    ) : (
                      <div className="w-[180px] h-[180px] flex items-center justify-center text-zinc-600 text-xs font-mono">
                        Đang tạo mã QR...
                      </div>
                    )}
                    <span className="mt-2 text-[10px] font-bold tracking-wider text-zinc-900 uppercase">
                      Quét để chọn bài
                    </span>
                  </div>

                  {/* Room Details & Instructions */}
                  <div className="text-left space-y-4 max-w-xs">
                    <div>
                      <span className="text-xs text-zinc-400 font-medium">
                        Mã phòng hát
                      </span>
                      <div className="text-4xl font-extrabold font-mono tracking-widest text-white mt-0.5">
                        {roomId}
                      </div>
                    </div>

                    {/* Admin PIN Box */}
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900/80 border border-white/[0.08] rounded-xl text-xs">
                        <Lock className="w-3.5 h-3.5 text-amber-400/80 shrink-0 stroke-[1.75]" />
                        <span className="text-zinc-400">PIN quản trị:</span>
                        <span className="font-mono font-bold text-amber-300 tracking-wider">
                          {showPin ? hostPin || "----" : "••••"}
                        </span>
                        <button
                          onClick={() => setShowPin(!showPin)}
                          className="ml-1 p-0.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                          title={showPin ? "Ẩn mã PIN" : "Hiện mã PIN quản trị"}
                        >
                          {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed font-normal">
                      Mở camera trên điện thoại quét mã QR hoặc truy cập đường dẫn để bắt đầu chọn bài.
                    </p>

                    {/* Connected Controllers Counter */}
                    <div className="pt-2 flex items-center gap-2 text-xs font-medium text-zinc-300 border-t border-white/[0.06]">
                      <Smartphone className="w-3.5 h-3.5 text-zinc-400 stroke-[1.75]" />
                      <span>
                        Đã kết nối: <b className="text-emerald-400 font-mono">{controllersCount}</b> thiết bị
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Discrete Sample Injector for Dev (Subtle & Unobtrusive) */}
              <div className="pt-2 flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                <span className="text-[11px] text-zinc-500">Thử nhanh bài mẫu:</span>
                <button
                  onClick={() => addSampleSong("youtube")}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] rounded-lg border border-white/[0.08] transition-colors cursor-pointer"
                >
                  Bài YouTube
                </button>
                <button
                  onClick={() => addSampleSong("local")}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[11px] rounded-lg border border-white/[0.08] transition-colors cursor-pointer"
                >
                  Video Local
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            2. TOP OVERLAY (Minimal Glass Pill Bar)
           ========================================================================= */}
        <div className="absolute top-0 left-0 right-0 p-5 flex items-start justify-between z-20 pointer-events-none bg-gradient-to-b from-black/80 via-black/30 to-transparent">
          {/* Top Left: Room Code & Admin PIN & Status */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="flex items-center gap-2 bg-zinc-950/80 border border-white/[0.08] backdrop-blur-xl px-3 py-1.5 rounded-xl text-xs font-medium">
              <span className="text-zinc-500 font-mono">PHÒNG</span>
              <span className="font-mono text-sm font-bold tracking-wider text-white">
                {roomId}
              </span>
            </div>

            {/* Admin PIN Pill */}
            <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-white/[0.08] backdrop-blur-xl px-2.5 py-1.5 rounded-xl text-xs">
              <Lock className="w-3 h-3 text-amber-400/80 shrink-0 stroke-[1.75]" />
              <span className="font-mono text-xs font-semibold text-zinc-300">
                {showPin ? hostPin || "----" : "••••"}
              </span>
              <button
                onClick={() => setShowPin(!showPin)}
                className="p-0.5 text-zinc-500 hover:text-white transition-colors cursor-pointer"
                title={showPin ? "Ẩn mã PIN" : "Hiện mã PIN quản trị"}
              >
                {showPin ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-white/[0.08] backdrop-blur-xl px-2.5 py-1.5 rounded-xl text-xs text-zinc-400 font-mono">
              <Smartphone className="w-3.5 h-3.5 text-zinc-400 stroke-[1.75]" />
              <span className="text-white font-bold">{controllersCount}</span>
            </div>

            {/* Close Room Button */}
            <button
              onClick={() => setShowCloseConfirm(true)}
              className="flex items-center gap-1.5 bg-zinc-950/80 hover:bg-rose-950/40 border border-white/[0.08] hover:border-rose-500/30 text-zinc-400 hover:text-rose-300 backdrop-blur-xl px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer"
              title="Đóng phòng & Kết thúc buổi tiệc"
            >
              <LogOut className="w-3 h-3" />
              <span className="hidden md:inline">Đóng phòng</span>
            </button>
          </div>

          {/* Top Center / Right: Current Playing Song Banner */}
          {currentSong && (
            <div className="flex items-center gap-3 bg-zinc-950/80 border border-white/[0.08] backdrop-blur-xl px-4 py-2 rounded-xl pointer-events-auto max-w-lg shadow-xl shadow-black/40">
              <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <div className="text-left overflow-hidden min-w-0">
                <div className="text-xs font-semibold text-white truncate max-w-xs sm:max-w-sm">
                  {currentSong.title}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">
                  {currentSong.artist} • <span className="text-zinc-300">Yêu cầu bởi {currentSong.requestedBy}</span>
                </div>
              </div>

              {/* Tone Semitone Status */}
              {pitchShift !== 0 && (
                <div className="px-2 py-0.5 rounded bg-white/[0.06] text-amber-300 font-mono text-[11px] font-semibold shrink-0">
                  Tone: {pitchShift > 0 ? `+${pitchShift}` : pitchShift}
                </div>
              )}

              {/* Vocal Status */}
              {isVocalMuted && (
                <div className="px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300 text-[11px] font-medium shrink-0">
                  Beat
                </div>
              )}
            </div>
          )}

          {/* Top Far Right: Fullscreen Button */}
          <div className="pointer-events-auto">
            <button
              onClick={toggleFullScreen}
              className="p-2 bg-zinc-950/80 hover:bg-zinc-800 border border-white/[0.08] rounded-xl text-zinc-400 hover:text-white transition-colors cursor-pointer backdrop-blur-xl"
              title="Toàn màn hình TV"
            >
              <Maximize2 className="w-4 h-4 stroke-[1.75]" />
            </button>
          </div>
        </div>

        {/* =========================================================================
            3. BOTTOM OVERLAY: Upcoming Next Song Toast & Progress Bar
           ========================================================================= */}
        {currentSong && (
          <div className="absolute bottom-0 left-0 right-0 p-5 flex flex-col gap-3 z-20 pointer-events-none bg-gradient-to-t from-black/90 via-black/40 to-transparent">
            {/* NEXT SONG TOAST (When remainingTime <= 20s) */}
            {isLast20Seconds && nextSong && (
              <div className="self-start pointer-events-auto animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-zinc-950/90 border border-white/[0.1] rounded-xl shadow-2xl backdrop-blur-xl">
                  <div className="p-1.5 bg-white/[0.08] rounded-lg text-amber-400">
                    <Bell className="w-4 h-4 stroke-[1.75]" />
                  </div>
                  <div className="text-left text-xs">
                    <div className="text-[10px] text-zinc-400 font-medium">
                      Bài kế tiếp (sau {Math.round(remainingTime)}s):
                    </div>
                    <div className="font-semibold text-white truncate max-w-sm">
                      {nextSong.title}
                    </div>
                    <div className="text-[11px] text-zinc-400">
                      Do {nextSong.requestedBy} đặt
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Song Duration / Clean Progress Bar */}
            <div className="w-full flex items-center gap-3 text-xs font-mono text-zinc-500 pointer-events-none">
              <span>{formatSeconds(currentTime)}</span>
              <div className="flex-1 h-1 bg-white/[0.1] rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-300"
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
            4. DANMAKU BARRAGE LAYER
           ========================================================================= */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
          {danmakuList.map((item) => (
            <div
              key={item.id}
              className="absolute whitespace-nowrap animate-danmaku font-bold text-xl md:text-3xl tracking-wide danmaku-text select-none flex items-center gap-2"
              style={{
                top: `${item.topPercent}%`,
                animationDuration: `${item.durationSec}s`,
                color: item.color || "#ffffff",
              }}
            >
              <span className="text-[10px] bg-black/60 text-white/90 px-2 py-0.5 rounded-full border border-white/20 font-medium shadow-sm">
                {item.sender}
              </span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        {/* =========================================================================
            5. FLOATING EMOJI PARTICLES
           ========================================================================= */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
          {cheers.map((item) => (
            <div
              key={item.id}
              className="absolute bottom-6 animate-float-up text-4xl md:text-5xl drop-shadow-xl select-none"
              style={{
                left: `${item.left}%`,
                animationDuration: `${item.animationDuration}s`,
              }}
            >
              {item.emoji}
            </div>
          ))}
        </div>

        {/* =========================================================================
            6. FADING OUT INDICATOR
           ========================================================================= */}
        {isFadingOut && !scoreData && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-zinc-950/90 backdrop-blur-xl border border-white/[0.1] px-6 py-4 rounded-2xl flex items-center gap-3 text-white shadow-2xl">
            <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            <div className="text-left">
              <p className="text-sm font-semibold text-white">Hoàn tất bài hát...</p>
              <p className="text-xs text-zinc-400">Đang tính điểm số</p>
            </div>
          </div>
        )}

        {/* =========================================================================
            7. KARAOKE SCORING OVERLAY (Stage Red Silk BR - Frameless & Boxless)
           ========================================================================= */}
        {scoreData && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-between p-6 sm:p-12 text-center select-none overflow-hidden animate-in fade-in duration-500">
            {/* Background: Dramatic Red Silk Waves & Atmospheric Stage Glow */}
            <div
              className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none z-0"
              style={{ backgroundImage: "url('/images/karaoke-bg-red.jpg')" }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/60" />
              {/* Pulsing Red & Amber Core Stage Lighting */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] sm:w-[750px] h-[550px] sm:h-[750px] bg-red-600/35 rounded-full blur-[130px] pointer-events-none animate-aura-pulse" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[380px] h-[280px] sm:h-[380px] bg-amber-400/25 rounded-full blur-[80px] pointer-events-none" />
            </div>

            {/* Top Song Info - Frameless directly on stage */}
            <div className="relative z-10 pt-2 sm:pt-4 space-y-2 max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs uppercase tracking-widest text-amber-300 font-semibold shadow-lg">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Tổng kết màn trình diễn</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <h2 className="text-2xl sm:text-5xl font-black text-white tracking-tight drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] truncate px-4">
                {scoreData.songTitle}
              </h2>
              <p className="text-xs sm:text-base text-zinc-300 drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                Trình bày: <b className="text-amber-300 font-bold">{scoreData.singerName}</b>
              </p>
            </div>

            {/* Center Massive Glowing Score - Frameless & Impactful */}
            <div className="relative z-10 flex flex-col items-center justify-center my-auto py-2">
              <div className="relative flex items-center justify-center">
                {/* Subtle trophy icon backdrop */}
                <div className="absolute -top-12 opacity-15 pointer-events-none">
                  <Trophy className="w-36 h-36 text-amber-300 stroke-[1]" />
                </div>

                {/* Gigantic Score Number */}
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-8xl sm:text-[140px] font-black tracking-tighter font-mono text-transparent bg-clip-text bg-gradient-to-b from-white via-amber-100 to-amber-400 drop-shadow-[0_0_60px_rgba(251,191,36,0.7)] leading-none select-none">
                    {scoreData.displayScore}
                  </span>
                  <span className="text-2xl sm:text-4xl font-extrabold text-white/50 tracking-wide font-mono">
                    / 100
                  </span>
                </div>
              </div>

              {/* Award Title Callout */}
              <div className="mt-4 inline-flex items-center gap-2.5 px-6 py-2 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-sm sm:text-lg font-bold text-amber-300 backdrop-blur-md shadow-[0_0_35px_rgba(245,158,11,0.35)]">
                <Award className="w-5 h-5 text-amber-400" />
                <span>{scoreData.title}</span>
              </div>
            </div>

            {/* Bottom Controls: Skip Now & Countdown - Frameless */}
            <div className="relative z-10 pb-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={skipScoringNow}
                className="px-6 py-3 rounded-2xl bg-white hover:bg-zinc-200 text-zinc-950 font-bold text-xs sm:text-sm shadow-2xl transition-all active:scale-95 flex items-center gap-2 cursor-pointer backdrop-blur-md"
              >
                <span>Chuyển bài tiếp theo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <span className="text-xs sm:text-sm text-zinc-300 font-mono tracking-wide">
                Tự động chuyển sau <b className="text-white font-bold">{scoreData.countdown}s</b>
              </span>
            </div>
          </div>
        )}

        {/* =========================================================================
            8. MODAL: XÁC NHẬN ĐÓNG PHÒNG
           ========================================================================= */}
        {showCloseConfirm && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none pointer-events-auto">
            <div className="w-full max-w-sm bg-zinc-900 border border-white/[0.1] rounded-2xl p-6 shadow-2xl text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-6 h-6 stroke-[1.75]" />
              </div>

              <div>
                <h3 className="text-base font-bold text-white">Đóng phòng hát?</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Phòng <b className="text-white font-mono">{roomId}</b> sẽ bị đóng vĩnh viễn và ngắt kết nối các thiết bị đang tham gia.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => setShowCloseConfirm(false)}
                  disabled={isClosingRoom}
                  className="flex-1 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  onClick={handleCloseRoom}
                  disabled={isClosingRoom}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isClosingRoom ? "Đang đóng..." : "Đóng phòng"}
                </button>
              </div>
            </div>
          </div>
        )}
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

export default function HostRoomPage(props: HostPageProps) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-sm text-slate-300 font-bold">Đang kết nối màn hình TV...</span>
        </div>
      }
    >
      <HostRoomContent {...props} />
    </React.Suspense>
  );
}
