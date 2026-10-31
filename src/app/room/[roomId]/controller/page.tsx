"use client";

import React, { useEffect, useState, use, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import {
  QueueItem,
  RoomState,
  SyncStatePayload,
  ControlAction,
  CheerType,
  RoomSettings,
  ScoreResult,
} from "@/types/socket";
import CastButton, { CastStatus } from "@/components/CastButton";
import CastDeviceModal from "@/components/CastDeviceModal";
import PocketVideoMirror from "@/components/PocketVideoMirror";
import { getDeviceName, saveRecentDevice } from "@/lib/cast-storage";
import { YouTubeSearchResult } from "@/app/api/search-youtube/route";
import KaraokeSeekBar from "@/components/KaraokeSeekBar";
import SearchBarWithAutocomplete from "@/components/SearchBarWithAutocomplete";
import {
  FavoriteSong,
  getFavorites,
  toggleFavorite,
  removeFavorite,
} from "@/lib/favorites";
import {
  matchesSmartSearch,
  extractAcronym,
  removeVietnameseTones,
} from "@/lib/vietnamese-search";
import {
  CURATED_CATEGORIES,
  CuratedSong,
} from "@/lib/curated-playlists";
import {
  Smartphone,
  Tv,
  Wifi,
  WifiOff,
  CheckCircle2,
  Music,
  ListMusic,
  Volume2,
  Sparkles,
  ArrowLeft,
  Radio,
  Send,
  PartyPopper,
  Play,
  Pause,
  SkipForward,
  PlusCircle,
  Flame,
  Heart,
  ThumbsUp,
  Trash2,
  Search,
  Clock,
  Loader2,
  Check,
  Zap,
  Bookmark,
  X,
  Mic2,
  SlidersHorizontal,
  Crown,
  Lock,
  Unlock,
  Key,
  User,
  Edit3,
  ShieldCheck,
  Sun,
  Moon,
  FileText,
  Settings,
  Trophy,
  Award,
  LogOut,
  AlertTriangle,
  AlertCircle,
  MoreHorizontal,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

interface ControllerPageProps {
  params: Promise<{
    roomId: string;
  }>;
}

function ControllerContent({ params }: ControllerPageProps) {
  const resolvedParams = use(params);
  const rawRoomId = resolvedParams.roomId;
  const roomId = rawRoomId ? rawRoomId.toUpperCase() : "";

  const router = useRouter();
  const [showCastModal, setShowCastModal] = useState(false);
  const [tvName, setTvName] = useState(() => getDeviceName(roomId));
  const [pingMs, setPingMs] = useState<number | null>(null);

  // Navigation tabs: 'search' | 'favorites' | 'queue' | 'soundboard'
  const [activeTab, setActiveTab] = useState<"search" | "favorites" | "queue" | "soundboard">("search");

  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [hostConnected, setHostConnected] = useState(false);
  const [controllersCount, setControllersCount] = useState<number>(0);

  // Computed Cast Status
  const castStatus: CastStatus = hasJoined
    ? "connected"
    : isConnected
    ? "connecting"
    : "disconnected";

  // Playback & Queue synchronized from Host
  const [currentSong, setCurrentSong] = useState<QueueItem | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);

  // YouTube Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [searchedKeyword, setSearchedKeyword] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Live Reactions & Danmaku States
  const [reactionText, setReactionText] = useState("");
  const [senderName, setSenderName] = useState("Điện thoại");

  // Local Identity States (stored in phone localStorage)
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("Khách hát");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>("");

  // Room Role States ('guest' | 'admin') & Admin PIN Modal
  const [controllerRole, setControllerRole] = useState<"guest" | "admin">("guest");
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>("");
  const [adminPin, setAdminPin] = useState<string>("");

  // Audio DSP States (Tone Transpose & Stereo Vocal Splitter)
  const [vocalMuted, setVocalMuted] = useState(false);
  const [pitchShift, setPitchShift] = useState(0); // -4 to +4 semitones

  // Room Settings (Mục 3: Fair Play queue limit & scoring toggle)
  const [roomSettings, setRoomSettings] = useState<RoomSettings>({
    fairPlayEnabled: false,
    maxQueuePerUser: 2,
    scoringEnabled: true,
  });
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [tempFairPlay, setTempFairPlay] = useState<boolean>(false);
  const [tempMaxQueue, setTempMaxQueue] = useState<number>(2);

  // Wake Lock Screen Keeping (Mục 5: Mặc định TẮT để tiết kiệm pin theo yêu cầu)
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  // Room Closed & Lifecycle States (Phòng thật sự đã đóng hoặc không tồn tại)
  const [isRoomClosed, setIsRoomClosed] = useState<boolean>(false);
  const [roomClosedReason, setRoomClosedReason] = useState<string>("");

  // Player Remote Controls expand/collapse state
  const [isPlayerExpanded, setIsPlayerExpanded] = useState<boolean>(false);

  // Pocket Video Mirror (Giải pháp 1.2: Màn hình phụ bỏ túi xem trực tiếp TV đã tắt tiếng)
  const [showVideoMirror, setShowVideoMirror] = useState<boolean>(false);

  // Handheld Synchronized Lyrics (Mục 2: Lời bài hát chạy trên điện thoại)
  const [showLyricsModal, setShowLyricsModal] = useState<boolean>(false);
  const [lyricsData, setLyricsData] = useState<{
    title: string;
    artist: string;
    lines: Array<{ time: number; text: string }>;
    isFallback?: boolean;
  } | null>(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState<boolean>(false);
  const [lyricsFontSize, setLyricsFontSize] = useState<number>(17);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const lyricsContainerRef = useRef<HTMLDivElement | null>(null);

  // Quick Action Menu Drawer (Thực đơn cài đặt & tùy chọn phòng)
  const [showQuickMenu, setShowQuickMenu] = useState<boolean>(false);

  // Curated Playlist Category Filter (Mục 4: Mặc định rỗng để màn hình sạch sẽ khi mới vào phòng)
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // Favorites States (stored in phone localStorage)
  const [favorites, setFavorites] = useState<FavoriteSong[]>([]);
  const [favoriteSearchQuery, setFavoriteSearchQuery] = useState("");

  // Load identity and favorites from phone localStorage on mount
  useEffect(() => {
    setFavorites(getFavorites());

    if (typeof window !== "undefined") {
      let storedId = localStorage.getItem("karaoke_user_id");
      if (!storedId) {
        storedId = `user_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
        localStorage.setItem("karaoke_user_id", storedId);
      }
      setUserId(storedId);

      const storedName = localStorage.getItem("karaoke_user_name");
      if (storedName) {
        setUserName(storedName);
        setSenderName(storedName);
        setNameInput(storedName);
      } else {
        setNameInput("Khách hát");
      }

      if (roomId) {
        const savedPin =
          sessionStorage.getItem(`karaoke_admin_pin_${roomId}`) ||
          localStorage.getItem(`karaoke_admin_pin_${roomId}`);
        if (savedPin) {
          setAdminPin(savedPin);
        }
      }
    }
  }, [roomId]);

  // Quick lookup set for fast favorite heart status
  const favoriteIdSet = useMemo(() => {
    return new Set(favorites.map((f) => f.youtubeId));
  }, [favorites]);

  // Show Toast notification helper
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Toggle Favorite
  const handleToggleFavorite = (
    song: {
      youtubeId: string;
      title: string;
      channelTitle?: string;
      artist?: string;
      thumbnail: string;
      duration?: string;
      durationSec?: number;
    },
    e?: React.MouseEvent
  ) => {
    if (e) e.stopPropagation();

    const { isFav, favorites: updated } = toggleFavorite({
      youtubeId: song.youtubeId,
      title: song.title,
      artist: song.artist || song.channelTitle || "Karaoke Beat",
      thumbnail: song.thumbnail,
      duration: song.duration,
      durationSec: song.durationSec,
    });

    setFavorites(updated);
    if (isFav) {
      showToast(`❤️ Đã lưu "${song.title.substring(0, 24)}..." vào Bài tủ!`);
    } else {
      showToast(`Đã xóa khỏi Bài tủ`);
    }
  };

  // Auto connect and join room as CONTROLLER on mount
  useEffect(() => {
    if (!roomId) return;

    const socket = getSocket();

    const joinAsController = () => {
      const savedPin =
        typeof window !== "undefined"
          ? sessionStorage.getItem(`karaoke_admin_pin_${roomId}`) ||
            localStorage.getItem(`karaoke_admin_pin_${roomId}`)
          : undefined;

      console.log(`[Controller] Joining room ${roomId} as CONTROLLER... (PIN: ${savedPin ? "YES" : "NO"})`);
      socket.emit("client:join-room", {
        roomId,
        role: "controller",
        nickname: userName || "Khách hát",
        userId,
        pin: savedPin || undefined,
      });
    };

    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id || "");
      joinAsController();
    }

    function onDisconnect() {
      setIsConnected(false);
      setHasJoined(false);
    }

    function onRoomJoined(res: {
      success: boolean;
      room?: RoomState;
      role?: string;
      controllerRole?: "admin" | "guest";
      isRoomNotFound?: boolean;
      message?: string;
    }) {
      if (res.success && res.room) {
        setIsRoomClosed(false);
        setHasJoined(true);
        setHostConnected(!!res.room.host);
        setControllersCount(res.room.controllers.length);
        setCurrentSong(res.room.currentSong);
        setQueue(res.room.queue || []);
        setIsPlaying(res.room.isPlaying);
        if (res.controllerRole) setControllerRole(res.controllerRole);
        if (typeof res.room.vocalMuted === "boolean") setVocalMuted(res.room.vocalMuted);
        if (typeof res.room.pitchShift === "number") setPitchShift(res.room.pitchShift);
        if (res.room.settings) setRoomSettings(res.room.settings);
        saveRecentDevice(roomId, getDeviceName(roomId));
      } else {
        setHasJoined(false);
        if (res.isRoomNotFound) {
          setIsRoomClosed(true);
          setRoomClosedReason(res.message || "Phòng hát này không tồn tại hoặc đã bị đóng bởi TV Host!");
          try {
            localStorage.removeItem("karaoke_last_room_id");
            localStorage.removeItem(`karaoke_admin_pin_${roomId}`);
          } catch (e) {}
        } else {
          showToast("⚠️ " + (res.message || "Không thể tham gia phòng"));
        }
      }
    }

    function onRoomClosed(data: { roomId: string; reason?: string }) {
      if (data.roomId === roomId) {
        console.warn(`[Controller] Room ${roomId} was officially closed.`);
        setIsRoomClosed(true);
        setHasJoined(false);
        setRoomClosedReason(data.reason || "TV Host đã đóng phòng và kết thúc buổi tiệc Karaoke.");
        try {
          localStorage.removeItem("karaoke_last_room_id");
          localStorage.removeItem(`karaoke_admin_pin_${roomId}`);
        } catch (e) {}
      }
    }

    function onSyncState(payload: SyncStatePayload) {
      if (payload.roomId === roomId) {
        setHostConnected(!!payload.host);
        setControllersCount(payload.controllersCount);
        setCurrentSong(payload.currentSong);
        setQueue(payload.queue || []);
        setIsPlaying(payload.isPlaying);
        if (payload.adminSocketIds && socket.id) {
          if (payload.adminSocketIds.includes(socket.id)) {
            setControllerRole("admin");
          }
        }
        if (typeof payload.vocalMuted === "boolean") setVocalMuted(payload.vocalMuted);
        if (typeof payload.pitchShift === "number") setPitchShift(payload.pitchShift);
        if (payload.settings) setRoomSettings(payload.settings);
      }
    }

    function onRoomUpdated(data: { roomId: string; room: RoomState | null }) {
      if (data.roomId === roomId && data.room) {
        setHostConnected(!!data.room.host);
        setControllersCount(data.room.controllers.length);
        setCurrentSong(data.room.currentSong);
        setQueue(data.room.queue || []);
        setIsPlaying(data.room.isPlaying);
        if (data.room.adminSocketIds && socket.id) {
          if (data.room.adminSocketIds.includes(socket.id)) {
            setControllerRole("admin");
          }
        }
        if (typeof data.room.vocalMuted === "boolean") setVocalMuted(data.room.vocalMuted);
        if (typeof data.room.pitchShift === "number") setPitchShift(data.room.pitchShift);
        if (data.room.settings) setRoomSettings(data.room.settings);
      }
    }

    function onRoleUpdated(data: { role: "admin" | "guest"; success: boolean; message?: string }) {
      if (data.role) {
        setControllerRole(data.role);
        if (data.role === "admin") {
          showToast("👑 " + (data.message || "Bạn đã trở thành Chủ phòng!"));
        } else if (!data.success && data.message) {
          showToast("❌ " + data.message);
        }
      }
    }

    function onServerError(data: { message: string }) {
      showToast("⚠️ " + (data.message || "Hành động bị từ chối"));
    }

    function onTimeUpdate(data: { roomId: string; currentTime: number }) {
      if (data.roomId === roomId && typeof data.currentTime === "number") {
        setCurrentTime(data.currentTime);
      }
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room-joined", onRoomJoined);
    socket.on("server:sync-state", onSyncState);
    socket.on("room-updated", onRoomUpdated);
    socket.on("server:role-updated", onRoleUpdated);
    socket.on("server:error", onServerError);
    socket.on("host:time-update", onTimeUpdate);
    socket.on("server:room-closed", onRoomClosed);

    if (socket.connected) {
      onConnect();
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room-joined", onRoomJoined);
      socket.off("server:sync-state", onSyncState);
      socket.off("room-updated", onRoomUpdated);
      socket.off("server:role-updated", onRoleUpdated);
      socket.off("server:error", onServerError);
      socket.off("host:time-update", onTimeUpdate);
      socket.off("server:room-closed", onRoomClosed);
    };
  }, [roomId, userName, userId]);

  // Periodic ping-pong latency measurement
  useEffect(() => {
    if (!hasJoined) {
      setPingMs(null);
      return;
    }
    const socket = getSocket();
    const measurePing = () => {
      const start = Date.now();
      socket.emit("ping", { timestamp: start }, () => {
        const latency = Date.now() - start;
        setPingMs(latency);
      });
    };
    measurePing();
    const interval = setInterval(measurePing, 4000);
    return () => clearInterval(interval);
  }, [hasJoined]);

  // Handle Disconnect & Change TV
  const handleDisconnectRoom = () => {
    const socket = getSocket();
    socket.emit("client:leave-room", { roomId });
    socket.emit("leave-room", { roomId });
    setHasJoined(false);
    showToast("Đã ngắt kết nối với TV");
    router.push("/controller");
  };

  const handleConnectRoom = (targetRoomId: string) => {
    if (!targetRoomId) return;
    router.push(`/room/${targetRoomId.toUpperCase()}/controller`);
  };

  // Execute YouTube Search via /api/search-youtube?q=...
  const handleSearch = async (overrideQuery?: string | React.FormEvent) => {
    if (overrideQuery && typeof overrideQuery !== "string") {
      overrideQuery.preventDefault();
    }
    const target = typeof overrideQuery === "string" ? overrideQuery : searchQuery;
    const query = target.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchedKeyword(query);
    setSelectedCategory("");

    try {
      const res = await fetch(`/api/search-youtube?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data?.results) {
        setSearchResults(data.results);
      }
    } catch (err) {
      console.error("[Controller] Search error:", err);
      showToast("Lỗi tìm kiếm bài hát, vui lòng thử lại!");
    } finally {
      setIsSearching(false);
    }
  };

  // Add Song from YouTube search results or Favorites to Queue
  const handleSelectSong = (
    song: {
      youtubeId: string;
      title: string;
      channelTitle?: string;
      artist?: string;
      durationSec?: number;
    },
    prioritize = false
  ) => {
    const socket = getSocket();
    const newItem: QueueItem = {
      id: `yt-${song.youtubeId}-${Date.now()}`,
      title: song.title,
      artist: song.artist || song.channelTitle || "Karaoke Beat",
      duration: song.durationSec || 240,
      source: "youtube",
      youtubeId: song.youtubeId,
      requestedBy: userName || "Điện thoại",
      userId: userId || undefined,
      userName: userName || "Điện thoại",
    };

    socket.emit("client:add-queue", {
      roomId,
      item: newItem,
    });

    if (prioritize) {
      socket.emit("client:prioritize", {
        roomId,
        itemId: newItem.id,
        userId,
        pin: adminPin || undefined,
      });
      showToast(`⚡ Đã ưu tiên: "${song.title.substring(0, 32)}..."`);
    } else {
      showToast(`Đã thêm: "${song.title.substring(0, 32)}..."`);
    }

    // Mark as added
    setAddedIds((prev) => new Set(prev).add(song.youtubeId));
  };

  // Claim Admin with 4-digit PIN
  const handleClaimAdmin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const pin = pinInput.trim();
    if (!pin) {
      showToast("Vui lòng nhập mã PIN 4 chữ số!");
      return;
    }
    const socket = getSocket();
    socket.emit("client:claim-admin", {
      roomId,
      pin,
      userId,
    });
    setAdminPin(pin);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(`karaoke_admin_pin_${roomId}`, pin);
    }
    setShowPinModal(false);
    setPinInput("");
  };

  // Save nickname
  const handleSaveName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = nameInput.trim();
    if (!clean) return;
    setUserName(clean);
    setSenderName(clean);
    if (typeof window !== "undefined") {
      localStorage.setItem("karaoke_user_name", clean);
    }
    setIsEditingName(false);
    showToast(`Đã đổi tên thành: "${clean}"`);
  };

  // Remove song from queue (Only Admin or Song Owner)
  const handleRemoveQueue = (itemId: string, itemTitle: string) => {
    const socket = getSocket();
    socket.emit("client:remove-queue", {
      roomId,
      itemId,
      userId,
      pin: adminPin || undefined,
    });
    showToast(`Đã yêu cầu xóa "${itemTitle.substring(0, 20)}..."`);
  };

  // Prioritize song in queue (Admin or Song Owner)
  const handlePrioritizeQueue = (itemId: string, itemTitle: string) => {
    const socket = getSocket();
    socket.emit("client:prioritize", {
      roomId,
      itemId,
      userId,
      pin: adminPin || undefined,
    });
    showToast(`⚡ Đã ưu tiên "${itemTitle.substring(0, 20)}..." lên tiếp theo!`);
  };

  // Filtered Favorites based on Smart Acronym Search
  const filteredFavorites = useMemo(() => {
    if (!favoriteSearchQuery.trim()) return favorites;
    return favorites.filter(
      (f) =>
        matchesSmartSearch(f.title, favoriteSearchQuery) ||
        matchesSmartSearch(f.artist, favoriteSearchQuery)
    );
  }, [favorites, favoriteSearchQuery]);

  // Remote Control command (play, pause, skip)
  const sendControl = (action: ControlAction, value?: any) => {
    const isMySongPlaying = Boolean(
      userId && currentSong?.userId && currentSong.userId === userId
    );

    // If skipping the song that I requested, allow it!
    if (action === "skip" && (controllerRole === "admin" || isMySongPlaying)) {
      const socket = getSocket();
      socket.emit("client:control", {
        roomId,
        action,
        value,
        userId,
        pin: adminPin || undefined,
      });
      showToast("⏩ Đã chuyển bài hát");
      return;
    }

    if (controllerRole !== "admin") {
      showToast("🔒 Chỉ chủ phòng mới có quyền điều khiển phát nhạc!");
      return;
    }
    const socket = getSocket();
    socket.emit("client:control", {
      roomId,
      action,
      value,
      userId,
      pin: adminPin || undefined,
    });
  };

  // Cheer Soundboard event
  const sendCheer = (type: CheerType) => {
    const socket = getSocket();
    socket.emit("client:cheer-sound", {
      roomId,
      type,
      sender: userName || "Điện thoại",
    });
    showToast(`Đã gửi hiệu ứng: ${type.toUpperCase()}`);
  };

  // Send Live Reaction (Danmaku text or Emoji)
  const handleSendReaction = (type: "text" | "emoji", content: string) => {
    const clean = content.trim().substring(0, 40);
    if (!clean) return;

    const socket = getSocket();
    socket.emit("client:send-reaction", {
      roomId,
      type,
      content: clean,
      senderName: userName.trim() || senderName.trim() || "Điện thoại",
    });

    if (type === "text") {
      setReactionText("");
      showToast(`Đã bắn chữ lên TV: "${clean}"`);
    } else {
      showToast(`Đã bắn ${clean} lên TV!`);
    }
  };

  // Toggle Vocal Mode (Ca sĩ / Beat) - Admin only
  const handleToggleVocal = () => {
    if (controllerRole !== "admin") {
      showToast("🔒 Chỉ chủ phòng mới có quyền đổi giọng ca sĩ / Beat!");
      return;
    }
    const next = !vocalMuted;
    setVocalMuted(next);
    sendControl(next ? "mute-vocal" : "unmute-vocal");
    showToast(next ? "🎧 Đã chọn: BEAT (Tắt ca sĩ)" : "🎤 Đã chọn: BẬT CA SĨ");
  };

  // Adjust Tone / Pitch Shift (-4 to +4 semitones) - Admin only
  const handleToneChange = (type: "up" | "down" | "reset") => {
    if (controllerRole !== "admin") {
      showToast("🔒 Chỉ chủ phòng mới có quyền đổi Tone bài hát!");
      return;
    }
    let next = pitchShift;
    if (type === "up") next = Math.min(4, pitchShift + 1);
    else if (type === "down") next = Math.max(-4, pitchShift - 1);
    else next = 0;

    setPitchShift(next);
    if (type === "up") sendControl("pitch-up");
    else if (type === "down") sendControl("pitch-down");
    else sendControl("pitch-reset");

    const label = next === 0 ? "Tone [Gốc]" : next > 0 ? `Tone [+${next}]` : `Tone [${next}]`;
    showToast(`🎵 ${label}`);
  };

  // Wake Lock Screen Keeping (Mục 5: Bật/Tắt giữ sáng màn hình, mặc định TẮT)
  const toggleWakeLock = async () => {
    if (isWakeLockActive) {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch (e) {}
        wakeLockRef.current = null;
      }
      setIsWakeLockActive(false);
      showToast("🌙 Đã tắt giữ sáng (Màn hình tự tắt tiết kiệm pin)");
    } else {
      try {
        if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
          const lock = await (navigator as any).wakeLock.request("screen");
          wakeLockRef.current = lock;
          lock.addEventListener("release", () => {
            setIsWakeLockActive(false);
          });
          setIsWakeLockActive(true);
          showToast("☀️ Đã bật giữ sáng (Màn hình luôn bật)");
        } else {
          showToast("Trình duyệt không hỗ trợ giữ màn hình sáng");
        }
      } catch (err) {
        console.warn("[Controller] WakeLock error:", err);
        showToast("Không thể kích hoạt giữ màn hình sáng");
      }
    }
  };

  // Release WakeLock when component unmounts
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        try {
          wakeLockRef.current.release();
        } catch (e) {}
      }
    };
  }, []);

  // Room Settings Modal Handler (Mục 3: Fair Play & Admin Settings)
  const handleOpenSettingsModal = () => {
    setTempFairPlay(roomSettings.fairPlayEnabled);
    setTempMaxQueue(roomSettings.maxQueuePerUser || 2);
    setShowSettingsModal(true);
  };

  const handleSaveSettings = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (controllerRole !== "admin") {
      showToast("🔒 Chỉ chủ phòng mới có quyền lưu cài đặt!");
      return;
    }
    const socket = getSocket();
    const updatedSettings: RoomSettings = {
      fairPlayEnabled: tempFairPlay,
      maxQueuePerUser: tempMaxQueue,
      scoringEnabled: true,
    };
    socket.emit("client:update-settings", {
      roomId,
      settings: updatedSettings,
      pin: adminPin || undefined,
    });
    setRoomSettings(updatedSettings);
    setShowSettingsModal(false);
    showToast("⚙️ Đã lưu cài đặt phòng thành công!");
  };

  // Close Room directly from Admin Controller
  const handleCloseRoomFromController = () => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn ĐÓNG PHÒNG ${roomId} và kết thúc buổi tiệc? Toàn bộ danh sách bài hát sẽ bị xóa và ngắt kết nối các thiết bị.`
      )
    ) {
      return;
    }
    const socket = getSocket();
    const pin =
      adminPin ||
      (typeof window !== "undefined"
        ? sessionStorage.getItem(`karaoke_admin_pin_${roomId}`) ||
          localStorage.getItem(`karaoke_admin_pin_${roomId}`)
        : undefined) ||
      undefined;

    socket.emit("client:close-room", { roomId, pin }, (res: any) => {
      if (res?.success) {
        setShowSettingsModal(false);
        setIsRoomClosed(true);
        setRoomClosedReason("Bạn (Chủ phòng VIP) đã chính thức đóng phòng hát.");
      } else {
        showToast("⚠️ " + (res?.message || "Không thể đóng phòng!"));
      }
    });
  };

  // Handheld Synchronized Lyrics Handlers (Mục 2)
  const handleOpenLyrics = async () => {
    if (!currentSong) {
      showToast("Chưa có bài hát nào đang phát!");
      return;
    }
    setShowLyricsModal(true);
    setIsLoadingLyrics(true);
    try {
      const res = await fetch(
        `/api/lyrics?title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(
          currentSong.artist || ""
        )}`
      );
      const data = await res.json();
      if (data?.lines) {
        setLyricsData(data);
      } else {
        setLyricsData({
          title: currentSong.title,
          artist: currentSong.artist || "Karaoke Beat",
          lines: [{ time: 0, text: "Chưa có dữ liệu lời cho bài hát này. Hãy cùng hát theo màn hình TV!" }],
          isFallback: true,
        });
      }
    } catch (err) {
      console.error("[Controller] Fetch lyrics error:", err);
      setLyricsData({
        title: currentSong.title,
        artist: currentSong.artist || "Karaoke Beat",
        lines: [{ time: 0, text: "Không thể tải lời bài hát lúc này. Hãy nhìn màn hình TV để hát!" }],
        isFallback: true,
      });
    } finally {
      setIsLoadingLyrics(false);
    }
  };

  // Re-fetch lyrics if current song changes while Lyrics Modal is open
  useEffect(() => {
    if (showLyricsModal && currentSong) {
      handleOpenLyrics();
    }
  }, [currentSong?.id]);

  // Compute active lyric line index based on currentTime
  const activeLyricIndex = useMemo(() => {
    if (!lyricsData || !lyricsData.lines || lyricsData.lines.length === 0) return -1;
    let idx = -1;
    for (let i = 0; i < lyricsData.lines.length; i++) {
      if (currentTime >= lyricsData.lines[i].time) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  }, [lyricsData, currentTime]);

  // Auto-scroll active lyric line into center view
  useEffect(() => {
    if (showLyricsModal && activeLyricIndex >= 0) {
      const el = document.getElementById(`lyric-line-${activeLyricIndex}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [activeLyricIndex, showLyricsModal]);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-white font-sans max-w-md mx-auto relative border-x border-white/[0.06] shadow-2xl pb-72">
      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-zinc-900 border border-white/[0.1] text-white text-xs font-semibold rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Sticky Top Header */}
      <header className="sticky top-0 z-40 px-3.5 py-3 bg-[#09090b]/95 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400 font-medium">Phòng:</span>
              <span className="text-sm font-bold font-mono tracking-wider text-white">
                {roomId}
              </span>
            </div>
            <div className="text-[10px] text-zinc-400 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${hostConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span>{hostConnected ? "TV Online" : "Chờ TV..."}</span>
            </div>
          </div>
        </div>

        {/* Right Header Actions: Cast Button, Nickname, More Options Menu */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* CAST TO TV BUTTON (Header Variant) */}
          <CastButton
            variant="header"
            status={castStatus}
            tvName={tvName}
            roomId={roomId}
            pingMs={pingMs}
            onClick={() => setShowCastModal(true)}
          />

          {/* User Nickname Button */}
          <button
            onClick={() => {
              setNameInput(userName);
              setIsEditingName(true);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Bấm để đổi tên hiển thị"
          >
            <User className="w-3.5 h-3.5 text-zinc-400 stroke-[1.75]" />
            <span className="max-w-[70px] truncate font-medium">{userName}</span>
          </button>

          {/* Quick Menu Button (...) */}
          <button
            onClick={() => setShowQuickMenu(!showQuickMenu)}
            className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Tùy chọn & Cài đặt phòng"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* QUICK OPTIONS DRAWER / SHEET */}
      {showQuickMenu && (
        <div className="sticky top-[57px] z-30 p-3 bg-zinc-900/98 backdrop-blur-2xl border-b border-white/[0.08] animate-in slide-in-from-top-2 duration-150 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1 pb-1 border-b border-white/[0.04]">
            <span>TÙY CHỌN PHÒNG</span>
            <button
              onClick={() => setShowQuickMenu(false)}
              className="p-0.5 text-zinc-500 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Wake Lock Toggle */}
            <button
              onClick={toggleWakeLock}
              className={`p-2.5 rounded-xl border flex items-center gap-2 text-left transition-colors cursor-pointer ${
                isWakeLockActive
                  ? "bg-amber-400/10 border-amber-400/30 text-amber-300"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white"
              }`}
            >
              {isWakeLockActive ? (
                <Sun className="w-4 h-4 text-amber-400 stroke-[1.75]" />
              ) : (
                <Moon className="w-4 h-4 text-zinc-500 stroke-[1.75]" />
              )}
              <div>
                <div className="font-semibold">{isWakeLockActive ? "Luôn sáng" : "Tự tắt màn"}</div>
                <div className="text-[10px] text-zinc-500">Tiết kiệm pin</div>
              </div>
            </button>

            {/* Admin PIN / Claim Admin */}
            {controllerRole === "admin" ? (
              <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-300 flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400 stroke-[1.75]" />
                <div>
                  <div className="font-semibold">VIP Host</div>
                  <div className="text-[10px] text-amber-400/70">Toàn quyền phòng</div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  setShowQuickMenu(false);
                  setShowPinModal(true);
                }}
                className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-zinc-400 hover:text-white flex items-center gap-2 transition-colors cursor-pointer text-left"
              >
                <Key className="w-4 h-4 text-amber-400 stroke-[1.75]" />
                <div>
                  <div className="font-semibold">Chủ phòng</div>
                  <div className="text-[10px] text-zinc-500">Nhập mã PIN TV</div>
                </div>
              </button>
            )}

            {/* Admin Room Settings */}
            {controllerRole === "admin" && (
              <button
                onClick={() => {
                  setShowQuickMenu(false);
                  handleOpenSettingsModal();
                }}
                className="p-2.5 rounded-xl bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.06] text-zinc-300 flex items-center gap-2 transition-colors cursor-pointer text-left col-span-2"
              >
                <Settings className="w-4 h-4 text-zinc-400 stroke-[1.75]" />
                <div className="flex-1">
                  <div className="font-semibold">Cài đặt phòng & Xếp hàng Fair Play</div>
                  <div className="text-[10px] text-zinc-500">Giới hạn số bài hát mỗi người trong bàn</div>
                </div>
              </button>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 1: TÌM BÀI HÁT YOUTUBE (Hỗ trợ viết tắt Acronym Matching)
         ========================================================================= */}
      {activeTab === "search" && (
        <main className="flex-1 p-4 space-y-4">
          {/* Smart Search Bar with Autocomplete Suggestions */}
          <SearchBarWithAutocomplete
            query={searchQuery}
            onChangeQuery={setSearchQuery}
            onSearch={(q) => handleSearch(q)}
            isSearching={isSearching}
            placeholder="Tìm bài hát, ca sĩ hoặc gõ tắt (VD: cdns, nhnt)..."
          />

          {/* Curated Categories Carousel */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-medium px-1">
              <span>Danh mục tuyển chọn:</span>
              <span className="text-[11px] text-zinc-500">Chạm để chọn thể loại</span>
            </div>

            {/* Category Pills Slider */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
              {CURATED_CATEGORIES.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      if (selectedCategory === cat.id) {
                        setSelectedCategory("");
                        setSearchResults([]);
                        setSearchedKeyword("");
                        setSearchQuery("");
                      } else {
                        setSelectedCategory(cat.id);
                        setSearchedKeyword(cat.name);
                        setSearchQuery(cat.name);
                        setIsSearching(true);
                        fetch(`/api/search-youtube?q=${encodeURIComponent(cat.searchQuery)}`)
                          .then((res) => res.json())
                          .then((data) => {
                            setSearchResults(data.results || []);
                          })
                          .catch((err) => {
                            console.error("[Controller] Category search error:", err);
                            showToast("Lỗi tìm kiếm thể loại, vui lòng thử lại!");
                          })
                          .finally(() => {
                            setIsSearching(false);
                          });
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full shrink-0 transition-all cursor-pointer flex items-center gap-1.5 font-medium text-xs active:scale-95 ${
                      isActive
                        ? "bg-white text-zinc-950 font-semibold shadow-sm"
                        : "bg-zinc-900 border border-white/[0.08] text-zinc-400 hover:text-white"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Acronym Tags */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-[11px] text-zinc-500 font-mono shrink-0 pl-1">Gõ tắt:</span>
            {[
              { label: "cdns", full: "Cắt Đôi Nỗi Sầu" },
              { label: "nhnt", full: "Nơi Này Có Anh" },
              { label: "bttl", full: "Bên Trên Tầng Lầu" },
              { label: "lt", full: "Lạc Trôi" },
              { label: "ndt", full: "Ngày Đầu Tiên" },
            ].map((tag) => (
              <button
                key={tag.label}
                type="button"
                onClick={() => {
                  setSelectedCategory("");
                  setSearchQuery(tag.label);
                  setIsSearching(true);
                  setSearchedKeyword(tag.label);
                  fetch(`/api/search-youtube?q=${encodeURIComponent(tag.label)}`)
                    .then((res) => res.json())
                    .then((data) => setSearchResults(data.results || []))
                    .finally(() => setIsSearching(false));
                }}
                className="px-2.5 py-1 bg-zinc-900/80 hover:bg-zinc-800 border border-white/[0.08] rounded-lg text-zinc-400 hover:text-white shrink-0 transition-colors cursor-pointer flex items-center gap-1 text-[11px]"
              >
                <span className="font-mono text-zinc-200 font-bold">{tag.label}</span>
                <span className="text-[10px] text-zinc-500">({tag.full})</span>
              </button>
            ))}
          </div>

          {/* Search Results List OR Clean Empty State */}
          <div className="space-y-3 pt-1">
            {(searchedKeyword || selectedCategory) && (
              <div className="flex items-center justify-between text-xs text-zinc-400 font-medium px-1">
                <span>
                  {selectedCategory ? (
                    <>
                      Thể loại:{" "}
                      <b className="text-white">
                        {CURATED_CATEGORIES.find((c) => c.id === selectedCategory)?.name}
                      </b>{" "}
                      ({searchResults.length} bài)
                    </>
                  ) : (
                    <>
                      Kết quả cho: <b className="text-white">&quot;{searchedKeyword}&quot;</b> ({searchResults.length})
                    </>
                  )}
                </span>
                <button
                  onClick={() => {
                    setSearchResults([]);
                    setSearchedKeyword("");
                    setSearchQuery("");
                    setSelectedCategory("");
                  }}
                  className="text-xs text-zinc-400 hover:text-white cursor-pointer underline"
                >
                  Xóa bộ lọc
                </button>
              </div>
            )}

            {isSearching ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-zinc-500 text-xs">
                <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />
                <span>Đang tìm kiếm bài hát karaoke...</span>
              </div>
            ) : searchResults.length > 0 ? (
              /* YouTube Search Results */
              <div className="space-y-2.5">
                {searchResults.map((item) => {
                  const isAdded = addedIds.has(item.youtubeId);
                  const isFav = favoriteIdSet.has(item.youtubeId);

                  return (
                    <div
                      key={item.youtubeId}
                      className="p-3 bg-zinc-900/50 hover:bg-zinc-900/80 border border-white/[0.06] hover:border-white/[0.12] rounded-2xl shadow-sm transition-all flex gap-3 backdrop-blur-sm relative"
                    >
                      {/* Video Thumbnail */}
                      <div className="relative w-28 h-20 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-white/[0.08]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                        {item.duration && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/85 text-[10px] font-mono text-white rounded">
                            {item.duration}
                          </span>
                        )}

                        {/* Favorite Heart Button over Thumbnail */}
                        <button
                          onClick={(e) => handleToggleFavorite(item, e)}
                          title={isFav ? "Xóa khỏi Bài tủ" : "Lưu vào Bài tủ"}
                          className="absolute top-1 left-1 p-1.5 bg-black/60 hover:bg-black/90 rounded-full transition-transform active:scale-125 cursor-pointer backdrop-blur-md"
                        >
                          <Heart
                            className={`w-3.5 h-3.5 transition-colors ${
                              isFav ? "fill-rose-500 text-rose-500" : "text-white/80 hover:text-rose-400"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Video Details & Action Buttons */}
                      <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        <div>
                          <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                            {item.title}
                          </h4>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-normal">
                            {item.channelTitle}
                          </p>

                          {/* Acronym Match Badge */}
                          {searchedKeyword && (
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate">
                              Chữ cái đầu: <span className="text-zinc-300">{extractAcronym(item.title).substring(0, 16)}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            onClick={() => handleSelectSong(item, false)}
                            className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isAdded
                                ? "bg-zinc-800 text-zinc-400 border border-white/[0.08]"
                                : "bg-white hover:bg-zinc-200 text-zinc-950 shadow-sm active:scale-95"
                            }`}
                          >
                            {isAdded ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Đã thêm</span>
                              </>
                            ) : (
                              <>
                                <PlusCircle className="w-3.5 h-3.5" />
                                <span>Chọn bài</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleSelectSong(item, true)}
                            title="Ưu tiên bài này hát ngay sau bài hiện tại"
                            className="py-1.5 px-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 rounded-xl text-xs font-medium flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                          >
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>Ưu tiên</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Clean Empty State when user first enters the room */
              <div className="py-12 px-4 rounded-2xl bg-zinc-900/30 border border-white/[0.06] text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400">
                  <Search className="w-5 h-5 text-zinc-400" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Bắt đầu chọn bài hát</h4>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                    Gõ tên bài hát hoặc ca sĩ vào thanh tìm kiếm, hoặc chạm vào danh mục thể loại ở trên để tìm bài nhanh.
                  </p>
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {/* =========================================================================
          TAB 2: BÀI TỦ (Favorites Saved in Phone LocalStorage)
         ========================================================================= */}
      {activeTab === "favorites" && (
        <main className="flex-1 p-4 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                <span>Danh sách Bài tủ ({favorites.length})</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                Lưu trên điện thoại của bạn • Chọn bài tức thì
              </p>
            </div>
          </div>

          {/* Search within Favorites (Smart Acronym Search) */}
          {favorites.length > 0 && (
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={favoriteSearchQuery}
                onChange={(e) => setFavoriteSearchQuery(e.target.value)}
                placeholder="Lọc bài tủ theo tên hoặc viết tắt..."
                className="w-full bg-zinc-900/60 border border-white/[0.08] focus:border-white/30 rounded-xl pl-9 pr-8 py-2 text-[16px] md:text-xs text-white placeholder-zinc-500 focus:outline-none transition-colors"
              />
              {favoriteSearchQuery && (
                <button
                  onClick={() => setFavoriteSearchQuery("")}
                  className="absolute right-2.5 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {/* List of Favorite Songs */}
          {filteredFavorites.length > 0 ? (
            <div className="space-y-2.5">
              {filteredFavorites.map((fav) => (
                <div
                  key={fav.youtubeId}
                  className="p-3 bg-zinc-900/50 hover:bg-zinc-900/80 border border-white/[0.06] hover:border-white/[0.12] rounded-2xl flex gap-3 shadow-sm backdrop-blur-sm transition-all"
                >
                  {/* Thumbnail with un-favorite button */}
                  <div className="relative w-28 h-20 bg-zinc-950 rounded-xl overflow-hidden shrink-0 border border-white/[0.08]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fav.thumbnail}
                      alt={fav.title}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={(e) => handleToggleFavorite(fav, e)}
                      title="Gỡ khỏi bài tủ"
                      className="absolute top-1 left-1 p-1.5 bg-black/60 rounded-full cursor-pointer hover:bg-black/90 backdrop-blur-md transition-transform active:scale-125"
                    >
                      <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                    </button>
                  </div>

                  {/* Title & Actions */}
                  <div className="flex-1 flex flex-col justify-between overflow-hidden">
                    <div>
                      <h4 className="text-xs font-semibold text-white line-clamp-2 leading-tight">
                        {fav.title}
                      </h4>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">{fav.artist}</p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleSelectSong(fav, false)}
                        className="flex-1 py-1.5 px-3 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        <span>Hát ngay</span>
                      </button>

                      <button
                        onClick={() => handleSelectSong(fav, true)}
                        className="py-1.5 px-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-200 rounded-xl text-xs font-medium flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>Ưu tiên</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : favorites.length > 0 ? (
            <div className="p-8 bg-zinc-900/40 border border-white/[0.06] rounded-2xl text-center space-y-2">
              <Search className="w-6 h-6 text-zinc-600 mx-auto" />
              <div className="text-xs text-zinc-400 font-medium">
                Không tìm thấy bài tủ nào khớp với &quot;{favoriteSearchQuery}&quot;.
              </div>
            </div>
          ) : (
            <div className="p-8 bg-zinc-900/40 border border-white/[0.06] rounded-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto text-rose-500">
                <Heart className="w-6 h-6 fill-rose-500/30" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">Chưa có bài tủ nào</h4>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  Hãy bấm biểu tượng trái tim <Heart className="w-3 h-3 inline text-rose-500 fill-rose-500" /> ở bất kỳ bài hát nào để lưu lại danh sách các bài bạn thích hát nhất.
                </p>
              </div>

              {/* Sample Add to Favorites button */}
              <button
                onClick={() => {
                  toggleFavorite({
                    youtubeId: "iIsfYYw4b2A",
                    title: "CẮT ĐÔI NỖI SẦU - TĂNG DUY TÂN (KARAOKE BEAT)",
                    artist: "Big Arts Entertainment",
                    thumbnail: "https://i.ytimg.com/vi/iIsfYYw4b2A/hqdefault.jpg",
                    duration: "4:12",
                    durationSec: 252,
                  });
                  setFavorites(getFavorites());
                  showToast("❤️ Đã thêm 'Cắt Đôi Nỗi Sầu' vào Bài tủ!");
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 hover:text-white rounded-xl transition-colors cursor-pointer border border-white/[0.08]"
              >
                <PlusCircle className="w-3.5 h-3.5 text-zinc-400" />
                <span>Thêm thử &quot;Cắt Đôi Nỗi Sầu&quot; vào Bài tủ</span>
              </button>
            </div>
          )}
        </main>
      )}

      {/* =========================================================================
          TAB 3: HÀNG ĐỢI (Queue)
         ========================================================================= */}
      {activeTab === "queue" && (
        <main className="flex-1 p-4 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-zinc-300" />
              <span>Hàng đợi bài hát ({queue.length})</span>
            </h3>
            <span className="text-[11px] text-zinc-500 font-mono">Tự động chuyển bài</span>
          </div>

          {queue.length > 0 ? (
            <div className="space-y-2">
              {queue.map((item, idx) => {
                const isFav = favoriteIdSet.has(item.youtubeId || "");
                const isMine = Boolean(userId && item.userId && item.userId === userId);
                const canDelete = controllerRole === "admin" || isMine;
                const canPrioritize = controllerRole === "admin" || isMine;

                return (
                  <div
                    key={item.id}
                    className={`p-3 bg-zinc-900/50 border rounded-2xl flex items-center justify-between gap-3 text-xs transition-colors backdrop-blur-sm ${
                      isMine ? "border-amber-500/30 bg-amber-950/10" : "border-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <span className="w-7 h-7 rounded-lg bg-zinc-800 text-zinc-300 font-mono text-xs font-medium flex items-center justify-center shrink-0 border border-white/[0.06]">
                        {(idx + 1).toString().padStart(2, "0")}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-white truncate flex items-center gap-1.5">
                          <span className="truncate">{item.title}</span>
                          {isMine && (
                            <span className="shrink-0 text-[10px] px-2 py-0.5 bg-amber-400/10 text-amber-300 border border-amber-400/20 rounded-md font-medium">
                              Của bạn
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                          {item.artist} • do <b className="text-zinc-200 font-medium">{item.requestedBy}</b>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Heart in Queue */}
                      {item.youtubeId && (
                        <button
                          onClick={(e) =>
                            handleToggleFavorite(
                              {
                                youtubeId: item.youtubeId!,
                                title: item.title,
                                artist: item.artist,
                                thumbnail: `https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`,
                              },
                              e
                            )
                          }
                          className="p-1.5 text-zinc-500 hover:text-rose-400 cursor-pointer transition-colors"
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              isFav ? "fill-rose-500 text-rose-500" : "text-zinc-500"
                            }`}
                          />
                        </button>
                      )}

                      {/* Prioritize Button (Admin OR Song Owner) */}
                      {canPrioritize ? (
                        <button
                          onClick={() => handlePrioritizeQueue(item.id, item.title)}
                          className="p-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-amber-400 rounded-xl transition-all cursor-pointer active:scale-95"
                          title={isMine ? "Ưu tiên bài của bạn lên tiếp theo" : "Ưu tiên bài hát (Quyền Chủ phòng)"}
                        >
                          <Zap className="w-4 h-4" />
                        </button>
                      ) : (
                        <div
                          title="Bài của người khác (Được bảo vệ)"
                          className="p-2 text-zinc-600 cursor-not-allowed opacity-40"
                        >
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                      )}

                      {/* Trash Delete Button (Admin OR Song Owner) */}
                      {canDelete && (
                        <button
                          onClick={() => handleRemoveQueue(item.id, item.title)}
                          className="p-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 rounded-xl transition-all cursor-pointer active:scale-95"
                          title={isMine ? "Xóa bài do bạn đặt" : "Xóa bài (Quyền Chủ phòng)"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 bg-zinc-900/40 border border-white/[0.06] rounded-2xl text-center space-y-2">
              <ListMusic className="w-8 h-8 text-zinc-600 mx-auto" />
              <div className="text-xs text-zinc-400 font-medium">
                Hàng đợi đang trống. Hãy chuyển sang tab &quot;Tìm bài&quot; hoặc &quot;Bài tủ&quot; để thêm bài hát mới!
              </div>
            </div>
          )}
        </main>
      )}

      {/* =========================================================================
          TAB 4: TƯƠNG TÁC & BẮN CHỮ (Danmaku Barrage & Live Reactions)
         ========================================================================= */}
      {activeTab === "soundboard" && (
        <main className="flex-1 p-4 space-y-4">
          {/* 1. BẮN CHỮ DANMAKU (Tối đa 40 ký tự) */}
          <div className="p-4 bg-zinc-900/50 border border-white/[0.08] rounded-2xl space-y-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  Bắn chữ lên TV (Danmaku)
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Tối đa 40 ký tự</span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Nhập lời cổ vũ hoặc tin nhắn vui nhộn để chữ bay ngang qua màn hình TV.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendReaction("text", reactionText);
              }}
              className="space-y-2.5"
            >
              <div className="relative">
                <input
                  type="text"
                  maxLength={40}
                  value={reactionText}
                  onChange={(e) => setReactionText(e.target.value)}
                  placeholder="Nhập lời cổ vũ (vd: Hát hay quá idol ơi!)..."
                  className="w-full bg-zinc-950 border border-white/[0.08] focus:border-white/30 rounded-xl px-3.5 py-2.5 text-[16px] md:text-xs text-white placeholder-zinc-500 outline-none pr-14 transition-colors"
                />
                <span
                  className={`absolute right-3 top-2.5 text-[10px] font-mono ${
                    reactionText.length >= 35 ? "text-amber-400 font-medium" : "text-zinc-500"
                  }`}
                >
                  {reactionText.length}/40
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={15}
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  placeholder="Tên của bạn"
                  className="w-28 bg-zinc-950 border border-white/[0.08] rounded-xl px-2.5 py-2 text-[16px] md:text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-white/30"
                />
                <button
                  type="submit"
                  disabled={!reactionText.trim()}
                  className="flex-1 py-2 px-4 bg-white hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed text-zinc-950 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Bắn lên TV</span>
                </button>
              </div>
            </form>

            {/* Quick suggested Danmaku phrases */}
            <div className="pt-1">
              <div className="text-[10px] text-zinc-500 font-medium mb-1.5">Gợi ý nhanh:</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "Hát hay quá bạn ơi! 🎤",
                  "10 điểm không có nhưng 💯",
                  "Lên nốt cao quá đỉnh 🔥",
                  "1 2 3 Dô 🍻",
                  "Hát tiếp bài nữa đê! ✨",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleSendReaction("text", preset)}
                    className="text-[11px] bg-zinc-950 hover:bg-zinc-800 text-zinc-300 border border-white/[0.06] hover:border-white/[0.12] px-2.5 py-1 rounded-lg transition-colors cursor-pointer active:scale-95"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. BẮN CẢM XÚC NHANH: 🔥, ❤️, 👏, 🍻, 💯 */}
          <div className="p-4 bg-zinc-900/50 border border-white/[0.08] rounded-2xl space-y-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-semibold text-zinc-200">
                  Cảm xúc trực tiếp
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Bay lơ lửng TV</span>
            </div>

            <p className="text-xs text-zinc-400">
              Chạm để bắn biểu tượng cảm xúc bay lên màn hình TV:
            </p>

            <div className="grid grid-cols-5 gap-2 pt-1">
              {[
                { emoji: "🔥", label: "Cháy" },
                { emoji: "❤️", label: "Thả tim" },
                { emoji: "👏", label: "Vỗ tay" },
                { emoji: "🍻", label: "Cụng ly" },
                { emoji: "💯", label: "100 điểm" },
              ].map((item) => (
                <button
                  key={item.emoji}
                  onClick={() => handleSendReaction("emoji", item.emoji)}
                  className="p-3 bg-zinc-950 hover:bg-zinc-800/80 border border-white/[0.06] hover:border-white/[0.15] rounded-2xl flex flex-col items-center gap-1 active:scale-90 transition-all cursor-pointer group"
                >
                  <span className="text-2xl group-hover:scale-115 transition-transform duration-200">
                    {item.emoji}
                  </span>
                  <span className="text-[10px] text-zinc-400 group-hover:text-zinc-200 font-medium">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. BỘ CHỈNH ÂM THANH (DSP: TONE & TÁCH LỜI CA SĨ) */}
          <div className="p-4 bg-zinc-900/50 border border-white/[0.08] rounded-2xl space-y-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-zinc-300" />
                <span className="text-xs font-semibold text-zinc-200">
                  Bộ xử lý âm thanh
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Stereo Splitter</span>
            </div>

            {/* A. Chỉnh Tone (Key Transpose: -4 đến +4 nửa cung) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <Music className="w-3.5 h-3.5 text-zinc-400" />
                  Chỉnh Tone (Cao độ):
                </span>
                <span
                  className={`font-mono font-medium px-2.5 py-0.5 rounded-lg text-xs border ${
                    pitchShift === 0
                      ? "bg-zinc-800 text-zinc-300 border-white/[0.08]"
                      : "bg-amber-950/60 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {pitchShift === 0 ? "Tone [Gốc]" : pitchShift > 0 ? `Tone [+${pitchShift}]` : `Tone [${pitchShift}]`}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleToneChange("down")}
                  disabled={pitchShift <= -4}
                  className="py-2.5 px-3 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 border border-white/[0.08] hover:border-white/[0.15] text-zinc-200 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>Tone [-]</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToneChange("reset")}
                  className={`py-2.5 px-3 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1 border active:scale-95 ${
                    pitchShift === 0
                      ? "bg-zinc-800 text-white border-white/[0.12]"
                      : "bg-zinc-950 text-zinc-300 border-white/[0.08] hover:bg-zinc-800"
                  }`}
                >
                  <span>Tone [Gốc]</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleToneChange("up")}
                  disabled={pitchShift >= 4}
                  className="py-2.5 px-3 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-30 border border-white/[0.08] hover:border-white/[0.15] text-zinc-200 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
                >
                  <span>Tone [+]</span>
                </button>
              </div>
            </div>

            {/* B. Toggle Ca sĩ / Beat */}
            <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <Mic2 className="w-3.5 h-3.5 text-zinc-400" />
                  Giọng ca sĩ (Stereo Splitter):
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Trái: Beat • Phải: Vocal</span>
              </div>

              <button
                type="button"
                onClick={handleToggleVocal}
                className={`w-full py-3 px-4 rounded-xl text-xs font-medium transition-all cursor-pointer flex items-center justify-between border active:scale-98 ${
                  vocalMuted
                    ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                    : "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{vocalMuted ? "🎧" : "🎤"}</span>
                  <div className="text-left">
                    <div className="font-semibold">{vocalMuted ? "Đang bật: Chế độ Beat (Tắt ca sĩ)" : "Đang bật: Có tiếng ca sĩ"}</div>
                    <div className="text-[10px] text-zinc-400">
                      {vocalMuted ? "Nhân đôi kênh Trái (Beat) ra 2 loa" : "Phát chuẩn Stereo cả 2 kênh"}
                    </div>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-black/40 rounded-lg text-[10px] font-mono border border-white/10 whitespace-nowrap">
                  Chuyển {vocalMuted ? "Ca sĩ" : "Beat"}
                </span>
              </button>
            </div>
          </div>

          {/* 4. HIỆU ỨNG ÂM THANH TV (Soundboard) */}
          <div className="p-4 bg-zinc-900/50 border border-white/[0.08] rounded-2xl space-y-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PartyPopper className="w-4 h-4 text-zinc-300" />
                <span className="text-xs font-semibold text-zinc-200">
                  Hiệu ứng âm thanh TV
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono">Loa TV</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => sendCheer("applause")}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-white/[0.06] hover:border-white/[0.12] rounded-xl flex flex-col items-center gap-1 text-zinc-200 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-2xl">👏</span>
                <span className="text-[11px] font-medium">Vỗ tay</span>
              </button>
              <button
                onClick={() => sendCheer("whistle")}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-white/[0.06] hover:border-white/[0.12] rounded-xl flex flex-col items-center gap-1 text-zinc-200 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-2xl">📣</span>
                <span className="text-[11px] font-medium">Huýt sáo</span>
              </button>
              <button
                onClick={() => sendCheer("cheer")}
                className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-white/[0.06] hover:border-white/[0.12] rounded-xl flex flex-col items-center gap-1 text-zinc-200 active:scale-95 transition-all cursor-pointer"
              >
                <span className="text-2xl">🥳</span>
                <span className="text-[11px] font-medium">Reo hò</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* =========================================================================
          PERSISTENT QUICK REACTIONS FLOATING BAR (🔥, ❤️, 👏, 🍻, 💯)
          Allows instant reaction from any tab without interrupting search/queue
         ========================================================================= */}
      <div className="fixed bottom-28 left-0 right-0 max-w-md mx-auto px-4 pointer-events-none z-30">
        <div className="pointer-events-auto bg-zinc-900/90 backdrop-blur-2xl border border-white/[0.1] rounded-full px-3 py-1.5 shadow-2xl flex items-center justify-between gap-1 max-w-xs mx-auto">
          {["🔥", "❤️", "👏", "🍻", "💯"].map((em) => (
            <button
              key={em}
              onClick={() => handleSendReaction("emoji", em)}
              className="p-1.5 hover:bg-white/[0.08] active:scale-125 rounded-full text-lg transition-transform cursor-pointer"
              title={`Bắn ${em} lên TV`}
            >
              {em}
            </button>
          ))}
          <div className="h-4 w-px bg-white/[0.1] mx-1" />
          <button
            onClick={() => setActiveTab("soundboard")}
            className="text-[10px] font-medium text-zinc-300 hover:text-white px-1.5 py-0.5 rounded transition-colors whitespace-nowrap cursor-pointer"
            title="Mở bảng bắn chữ Danmaku"
          >
            Bắn chữ 💬
          </button>
        </div>
      </div>

      {/* =========================================================================
          PINNED MINI PLAYER BAR (Sleek, Compact & Non-Obtrusive)
         ========================================================================= */}
      <div className="fixed bottom-14 left-0 right-0 max-w-md mx-auto px-3 py-1.5 z-30 pointer-events-auto">
        <div className="p-2.5 sm:p-3 bg-zinc-900/98 backdrop-blur-2xl border border-white/[0.1] rounded-2xl shadow-2xl flex flex-col gap-2">
          {/* Row 1: Song Info & Controls */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2 overflow-hidden flex-1">
              <div className="p-1.5 bg-white/[0.08] border border-white/[0.08] rounded-xl text-zinc-200 shrink-0">
                <Music className="w-3.5 h-3.5" />
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">
                  {currentSong ? currentSong.title : "TV đang ở chế độ chờ"}
                </div>
                <div className="text-[10px] sm:text-[11px] text-zinc-400 truncate">
                  {currentSong ? `${currentSong.artist}` : "Chọn bài bên dưới để bắt đầu"}
                </div>
              </div>
            </div>

            {/* Quick Remote Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* CAST TO TV BUTTON */}
              <CastButton
                variant="player"
                status={castStatus}
                tvName={tvName}
                roomId={roomId}
                pingMs={pingMs}
                onClick={() => setShowCastModal(true)}
              />

              {currentSong && (
                <>
                  {/* POCKET VIDEO MIRROR BUTTON */}
                  <button
                    onClick={() => setShowVideoMirror(true)}
                    className="relative p-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-300 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95"
                    title="Màn hình phụ bỏ túi: Xem trực tiếp video TV trên điện thoại"
                  >
                    <Tv className="w-3.5 h-3.5 text-zinc-300" />
                    {isPlaying && (
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    )}
                  </button>

                  {/* LYRICS BUTTON */}
                  <button
                    onClick={handleOpenLyrics}
                    className="p-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-300 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-95"
                    title="Xem lời bài hát chạy trên điện thoại"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-300" />
                  </button>

                  {controllerRole === "admin" ? (
                    <>
                      <button
                        onClick={() => sendControl(isPlaying ? "pause" : "play")}
                        className="p-2 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl transition-all cursor-pointer shadow-sm active:scale-95"
                        title={isPlaying ? "Tạm dừng" : "Tiếp tục phát"}
                      >
                        {isPlaying ? <Pause className="w-3.5 h-3.5 fill-zinc-950" /> : <Play className="w-3.5 h-3.5 fill-zinc-950" />}
                      </button>

                      <button
                        onClick={() => sendControl("skip")}
                        className="p-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-zinc-300 hover:text-white rounded-xl transition-all cursor-pointer active:scale-95"
                        title="Bỏ qua bài này (không chấm điểm)"
                      >
                        <SkipForward className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {currentSong.userId && currentSong.userId === userId && (
                        <button
                          onClick={() => sendControl("skip")}
                          className="px-2 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[11px] font-medium active:scale-95"
                          title="Bỏ qua bài hát do bạn chọn"
                        >
                          <SkipForward className="w-3 h-3 text-rose-400" />
                          <span>Bỏ qua</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          showToast("🔒 Nhập mã PIN 4 chữ số từ TV để mở khóa quyền Chủ phòng!");
                          setShowPinModal(true);
                        }}
                        className="px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-white/[0.08] text-zinc-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                        title="Chỉ chủ phòng mới có quyền điều khiển"
                      >
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] font-medium">Chủ phòng</span>
                      </button>
                    </div>
                  )}

                  {/* Expand / Collapse Toggle for Tone & Seekbar */}
                  <button
                    onClick={() => setIsPlayerExpanded((prev) => !prev)}
                    className={`p-2 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                      isPlayerExpanded
                        ? "bg-amber-400/15 border-amber-400/40 text-amber-300"
                        : "bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.08] text-zinc-400 hover:text-zinc-200"
                    }`}
                    title={isPlayerExpanded ? "Thu gọn thanh điều khiển" : "Mở rộng chỉnh Tone & Tua bài"}
                  >
                    {isPlayerExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronUp className="w-3.5 h-3.5" />
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 2 & Row 3: Only shown when song is active AND expanded */}
          {currentSong && isPlayerExpanded && (
            <div className="flex flex-col gap-2 pt-1 border-t border-white/[0.06] animate-in fade-in duration-150">
              {/* Row 2: Thanh tua kéo thả từ xa (Remote Scrubbing SeekBar) */}
              <div className="pt-0.5 px-0.5">
                {controllerRole === "admin" ? (
                  <KaraokeSeekBar roomId={roomId} disabled={!currentSong} />
                ) : (
                  <div
                    onClick={() => {
                      showToast("🔒 Chỉ chủ phòng mới có quyền tua video!");
                      setShowPinModal(true);
                    }}
                    className="cursor-pointer"
                    title="Chỉ chủ phòng mới có quyền tua video"
                  >
                    <KaraokeSeekBar roomId={roomId} disabled={true} />
                  </div>
                )}
              </div>

              {/* Row 3: Quick Audio DSP Controls (Tone [-] [Gốc] [+] & Ca sĩ/Beat) */}
              <div className="pt-1 flex items-center justify-between gap-2 text-[11px]">
                {/* Tone Semitone Controls */}
                <div
                  className={`flex items-center gap-1 bg-zinc-950 border border-white/[0.08] rounded-xl p-1 ${
                    controllerRole !== "admin" ? "opacity-60" : ""
                  }`}
                >
                  <span className="text-[10px] text-zinc-500 font-medium px-1">Tone:</span>
                  <button
                    type="button"
                    onClick={() => handleToneChange("down")}
                    disabled={pitchShift <= -4}
                    className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-zinc-200 font-medium cursor-pointer active:scale-95 text-[10px]"
                    title={controllerRole === "admin" ? "Giảm 1 nửa cung (Tone [-])" : "Chỉ chủ phòng mới có quyền"}
                  >
                    Tone [-]
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToneChange("reset")}
                    className={`px-2 py-0.5 rounded-lg font-mono text-[10px] font-medium cursor-pointer active:scale-95 ${
                      pitchShift === 0
                        ? "bg-zinc-800 text-zinc-300"
                        : "bg-amber-950/60 text-amber-300 border border-amber-500/30"
                    }`}
                    title={controllerRole === "admin" ? "Về Tone Gốc" : "Chỉ chủ phòng mới có quyền"}
                  >
                    {pitchShift === 0 ? "Tone [Gốc]" : pitchShift > 0 ? `[+${pitchShift}]` : `[${pitchShift}]`}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToneChange("up")}
                    disabled={pitchShift >= 4}
                    className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 rounded-lg text-zinc-200 font-medium cursor-pointer active:scale-95 text-[10px]"
                    title={controllerRole === "admin" ? "Tăng 1 nửa cung (Tone [+])" : "Chỉ chủ phòng mới có quyền"}
                  >
                    Tone [+]
                  </button>
                </div>

                {/* Vocal Splitter Toggle Button */}
                <button
                  type="button"
                  onClick={handleToggleVocal}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-medium flex items-center gap-1.5 border transition-all cursor-pointer active:scale-95 ${
                    controllerRole !== "admin" ? "opacity-60" : ""
                  } ${
                    vocalMuted
                      ? "bg-amber-950/40 border-amber-500/40 text-amber-300"
                      : "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  }`}
                  title={controllerRole === "admin" ? "Chuyển đổi Ca sĩ / Beat" : "Chỉ chủ phòng mới có quyền"}
                >
                  <span>{vocalMuted ? "🎧" : "🎤"}</span>
                  <span className="whitespace-nowrap">{vocalMuted ? "Beat" : "Ca sĩ"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MOBILE BOTTOM NAVIGATION BAR (4 Tabs: Tìm bài, Bài tủ, Hàng đợi, Tương tác)
         ========================================================================= */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-zinc-950/95 backdrop-blur-2xl border-t border-white/[0.08] p-2 flex items-center justify-around text-xs text-zinc-400 z-40">
        <button
          onClick={() => setActiveTab("search")}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            activeTab === "search" ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Search className="w-4 h-4" />
          <span className="text-[10px]">Tìm bài</span>
        </button>

        <button
          onClick={() => setActiveTab("favorites")}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer relative ${
            activeTab === "favorites" ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Heart className={`w-4 h-4 ${activeTab === "favorites" ? "fill-rose-500 text-rose-500" : ""}`} />
          <span className="text-[10px]">Bài tủ</span>
          {favorites.length > 0 && (
            <span className="absolute top-0 right-1.5 w-3.5 h-3.5 bg-zinc-100 text-zinc-950 text-[8px] font-mono font-bold rounded-full flex items-center justify-center">
              {favorites.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("queue")}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer relative ${
            activeTab === "queue" ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span className="text-[10px]">Hàng đợi</span>
          {queue.length > 0 && (
            <span className="absolute top-0 right-1.5 w-3.5 h-3.5 bg-zinc-100 text-zinc-950 text-[8px] font-mono font-bold rounded-full flex items-center justify-center">
              {queue.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("soundboard")}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            activeTab === "soundboard" ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <PartyPopper className="w-4 h-4" />
          <span className="text-[10px]">Tương tác</span>
        </button>

        {/* 5. PHÁT TRÊN TV (Cast to TV Tab) */}
        <CastButton
          variant="nav"
          status={castStatus}
          tvName={tvName}
          roomId={roomId}
          pingMs={pingMs}
          onClick={() => setShowCastModal(true)}
        />
      </footer>

      {/* =========================================================================
          MODAL: NHẬP MÃ PIN QUẢN TRỊ (Claim Admin Modal)
         ========================================================================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-zinc-900 border border-white/[0.1] rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-400/10 text-amber-300 rounded-xl border border-amber-400/20">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Xác thực chủ phòng</h3>
              </div>
              <button
                onClick={() => {
                  setShowPinModal(false);
                  setPinInput("");
                }}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Nhập mã PIN 4 chữ số hiển thị trên góc màn hình TV để mở khóa quyền điều khiển:
            </p>

            <form onSubmit={handleClaimAdmin} className="space-y-4">
              <div className="flex justify-center">
                <input
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="w-40 text-center tracking-[0.5em] text-2xl font-mono font-bold py-2.5 bg-zinc-950 border border-white/[0.12] focus:border-white/40 rounded-2xl text-white outline-none transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowPinModal(false);
                    setPinInput("");
                  }}
                  className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pinInput.length < 4}
                  className="flex-1 py-2 px-3 bg-white hover:bg-zinc-200 disabled:opacity-40 text-zinc-950 text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ĐỔI BIỆT DANH (Edit Nickname Modal)
         ========================================================================= */}
      {isEditingName && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-zinc-900 border border-white/[0.1] rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-1 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/[0.08] text-zinc-200 rounded-xl border border-white/[0.08]">
                  <User className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Đổi biệt danh</h3>
              </div>
              <button
                onClick={() => setIsEditingName(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Tên này sẽ hiển thị trên màn hình TV và danh sách chờ khi bạn chọn bài:
            </p>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <input
                  type="text"
                  maxLength={20}
                  autoFocus
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Nhập tên của bạn..."
                  className="w-full text-center text-[16px] md:text-sm font-medium py-2.5 px-3 bg-zinc-950 border border-white/[0.1] focus:border-white/40 rounded-xl text-white outline-none transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={!nameInput.trim()}
                  className="flex-1 py-2 px-3 bg-white hover:bg-zinc-200 disabled:opacity-40 text-zinc-950 text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  Lưu tên
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: CÀI ĐẶT PHÒNG & XẾP HÀNG CÔNG BẰNG (Mục 3: Room Settings Modal)
         ========================================================================= */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-white/[0.1] rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-white/[0.08] text-zinc-200 rounded-xl border border-white/[0.08]">
                  <Settings className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-semibold text-white">Cài đặt phòng hát</h3>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Option 1: Chế độ Xếp hàng công bằng (Fair Play) */}
              <div className="p-3 bg-zinc-950 border border-white/[0.08] rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚖️</span>
                    <div>
                      <div className="text-xs font-semibold text-white">Xếp hàng công bằng (Fair Play)</div>
                      <div className="text-[10px] text-zinc-400">Giới hạn số bài chờ mỗi người</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTempFairPlay(!tempFairPlay)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-200 ease-in-out ${
                      tempFairPlay ? "bg-white justify-end" : "bg-zinc-800 justify-start"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full shadow-md transform ${tempFairPlay ? "bg-zinc-950" : "bg-zinc-400"}`} />
                  </button>
                </div>

                <p className="text-[10px] text-zinc-400 leading-relaxed border-t border-white/[0.06] pt-1.5">
                  Khi bật, mỗi người chỉ được giữ tối đa{" "}
                  <b className="text-zinc-200">{tempMaxQueue} bài</b> trong hàng đợi. Hệ thống sẽ tự động tắt nếu phòng chỉ có 1 hoặc 2 người.
                </p>
              </div>

              {/* Option 2: Giới hạn số bài (1 - 5 bài) */}
              {tempFairPlay && (
                <div className="space-y-1.5 px-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-400 font-medium">Số bài tối đa mỗi người:</span>
                    <span className="font-mono font-medium text-white px-2 py-0.5 rounded bg-zinc-800 border border-white/[0.08]">
                      {tempMaxQueue} bài
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    {[1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setTempMaxQueue(num)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          tempMaxQueue === num
                            ? "bg-white text-zinc-950 border-white shadow-sm"
                            : "bg-zinc-950 text-zinc-400 border-white/[0.08] hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer active:scale-95"
                >
                  Lưu cài đặt
                </button>
              </div>

              {/* Danger Zone: Đóng phòng hát (Admin Only) */}
              <div className="pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={handleCloseRoomFromController}
                  className="w-full py-2 px-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-medium rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-400" />
                  <span>Đóng phòng & Kết thúc</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: LỜI BÀI HÁT ĐỒNG BỘ TRÊN ĐIỆN THOẠI (Mục 2: Handheld Lyrics Modal)
         ========================================================================= */}
      {showLyricsModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col p-4 max-w-md mx-auto animate-in fade-in zoom-in-95 duration-200">
          <div className="w-full flex-1 bg-zinc-950 border border-white/[0.1] rounded-3xl p-4 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] shrink-0">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div className="p-2 bg-white/[0.08] border border-white/[0.08] text-zinc-200 rounded-xl shrink-0">
                  <Mic2 className="w-4 h-4" />
                </div>
                <div className="overflow-hidden">
                  <h3 className="text-xs font-semibold text-white truncate">
                    {lyricsData?.title || currentSong?.title || "Lời bài hát"}
                  </h3>
                  <p className="text-[10px] text-zinc-400 truncate">
                    {lyricsData?.artist || currentSong?.artist || "Đang phát trên TV"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Switch to Video Mirror */}
                <button
                  onClick={() => {
                    setShowLyricsModal(false);
                    setShowVideoMirror(true);
                  }}
                  className="px-2.5 py-1 bg-zinc-900 border border-white/[0.1] rounded-lg text-zinc-200 text-[10px] font-medium hover:bg-zinc-800 active:scale-95 flex items-center gap-1"
                  title="Chuyển sang xem video trực tiếp trên điện thoại"
                >
                  <Tv className="w-3 h-3 text-zinc-300" />
                  <span>Xem Video</span>
                </button>

                {/* Font Size Adjusters */}
                <button
                  onClick={() => setLyricsFontSize((prev) => Math.max(13, prev - 2))}
                  className="px-2 py-1 bg-zinc-900 border border-white/[0.08] rounded-lg text-zinc-300 text-[10px] font-medium hover:bg-zinc-800 active:scale-95"
                  title="Thu nhỏ chữ"
                >
                  A-
                </button>
                <button
                  onClick={() => setLyricsFontSize((prev) => Math.min(24, prev + 2))}
                  className="px-2 py-1 bg-zinc-900 border border-white/[0.08] rounded-lg text-zinc-300 text-[10px] font-medium hover:bg-zinc-800 active:scale-95"
                  title="Phóng to chữ"
                >
                  A+
                </button>
                <button
                  onClick={() => setShowLyricsModal(false)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lyrics Content with Synchronized Auto-Scroll */}
            <div
              ref={lyricsContainerRef}
              className="flex-1 overflow-y-auto py-6 px-2 space-y-4 text-center scroll-smooth scrollbar-none"
            >
              {isLoadingLyrics ? (
                <div className="py-24 flex flex-col items-center justify-center gap-3 text-zinc-500 text-xs">
                  <Loader2 className="w-6 h-6 text-zinc-300 animate-spin" />
                  <span>Đang tải lời bài hát đồng bộ...</span>
                </div>
              ) : lyricsData && lyricsData.lines.length > 0 ? (
                lyricsData.lines.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  return (
                    <div
                      key={idx}
                      id={`lyric-line-${idx}`}
                      className={`transition-all duration-300 rounded-xl px-3 py-1.5 ${
                        isActive
                          ? "font-bold text-white bg-white/[0.08] border border-white/[0.15] scale-102"
                          : idx < activeLyricIndex
                          ? "text-zinc-600 font-normal"
                          : "text-zinc-400 font-medium"
                      }`}
                      style={{ fontSize: `${isActive ? lyricsFontSize + 2 : lyricsFontSize}px` }}
                    >
                      {line.text}
                    </div>
                  );
                })
              ) : (
                <div className="py-24 text-zinc-500 text-xs">
                  Chưa có dữ liệu lời cho bài hát này. Hãy cùng hát theo màn hình TV!
                </div>
              )}
            </div>

            {/* Footer indicator */}
            <div className="pt-2 border-t border-white/[0.08] text-[10px] text-zinc-500 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Đồng bộ trực tiếp với TV
              </span>
              <span>Bấm A+/A- để chỉnh cỡ chữ</span>
            </div>
          </div>
        </div>
      )}



      {/* =========================================================================
          MODAL / THEATER: POCKET VIDEO MIRROR (Giải pháp 1.2: Màn hình phụ bỏ túi)
         ========================================================================= */}
      <PocketVideoMirror
        isOpen={showVideoMirror}
        onClose={() => setShowVideoMirror(false)}
        currentSong={currentSong}
        isPlaying={isPlaying}
        currentTime={currentTime}
        onSendReaction={sendCheer}
        onSwitchToLyrics={() => {
          setShowVideoMirror(false);
          handleOpenLyrics();
        }}
      />

      {/* =========================================================================
          ROOM CLOSED SCREEN (Khi phòng không tồn tại hoặc TV Host đã đóng phòng)
         ========================================================================= */}
      {isRoomClosed && (
        <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>

          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-rose-500/10 text-rose-300 border border-rose-500/20 mb-2">
            Phòng đã đóng
          </span>

          <h2 className="text-xl font-semibold text-white mb-2">
            Phòng hát đã kết thúc
          </h2>

          <p className="text-xs text-zinc-400 max-w-xs mb-6 leading-relaxed">
            {roomClosedReason || "TV Host đã đóng phòng hoặc mã phòng này không còn tồn tại trên máy chủ."}
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-xs">
            <Link
              href="/"
              className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition flex items-center justify-center gap-2 cursor-pointer border border-white/[0.06]"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Về Trang Chủ</span>
            </Link>

            <button
              onClick={() => {
                setShowCastModal(true);
              }}
              className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-zinc-950 font-semibold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Kết nối TV khác</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL / BOTTOM SHEET: PHÁT TRÊN TV (CastDeviceModal)
         ========================================================================= */}
      <CastDeviceModal
        isOpen={showCastModal}
        onClose={() => setShowCastModal(false)}
        status={castStatus}
        currentRoomId={roomId}
        currentTvName={tvName}
        pingMs={pingMs}
        controllersCount={controllersCount}
        role={controllerRole}
        onConnectRoom={handleConnectRoom}
        onDisconnectRoom={handleDisconnectRoom}
        onUpdateTvName={(name) => setTvName(name)}
      />
    </div>
  );
}

export default function ControllerPage(props: ControllerPageProps) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs text-slate-400 font-medium">Đang tải phòng điều khiển...</span>
        </div>
      }
    >
      <ControllerContent {...props} />
    </React.Suspense>
  );
}
