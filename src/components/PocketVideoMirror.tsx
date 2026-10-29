"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { QueueItem, CheerType } from "@/types/socket";
import {
  X,
  VolumeX,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sparkles,
  Flame,
  Heart,
  PartyPopper,
  Tv,
  CheckCircle2,
  Layers,
  Smartphone,
  ExternalLink,
  FileText,
} from "lucide-react";

// Dynamically import react-youtube to avoid SSR hydration issues
const YouTube = dynamic(() => import("react-youtube"), { ssr: false });

interface PocketVideoMirrorProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: QueueItem | null;
  isPlaying: boolean;
  currentTime: number; // Current playback seconds from TV Host
  onSendReaction?: (type: CheerType) => void;
  onSwitchToLyrics?: () => void;
}

export default function PocketVideoMirror({
  isOpen,
  onClose,
  currentSong,
  isPlaying,
  currentTime,
  onSendReaction,
  onSwitchToLyrics,
}: PocketVideoMirrorProps) {
  // Player & Sync States
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isSynced, setIsSynced] = useState<boolean>(true);
  const [lastSyncDrift, setLastSyncDrift] = useState<number>(0);
  const [isMiniView, setIsMiniView] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);
  const wakeLockRef = useRef<any>(null);

  // 1. Keep Screen Awake while Pocket Video Mirror is open
  useEffect(() => {
    if (!isOpen) {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => { });
        wakeLockRef.current = null;
      }
      return;
    }

    const requestWake = async () => {
      try {
        if ("wakeLock" in navigator && !wakeLockRef.current) {
          wakeLockRef.current = await (navigator as any).wakeLock.request("screen");
          console.log("[PocketVideoMirror] Screen WakeLock acquired");
        }
      } catch (err) {
        console.warn("[PocketVideoMirror] WakeLock request error:", err);
      }
    };

    requestWake();

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => { });
        wakeLockRef.current = null;
      }
    };
  }, [isOpen]);

  // 2. Play / Pause Synchronization with TV Host
  useEffect(() => {
    if (!playerRef.current || !isOpen) return;
    try {
      if (isPlaying) {
        playerRef.current.playVideo();
      } else {
        playerRef.current.pauseVideo();
      }
    } catch (e) {
      console.warn("[PocketVideoMirror] Error toggling play state:", e);
    }
  }, [isPlaying, isOpen]);

  // 3. Time Drift Check & Auto-Seek to keep in lockstep with TV Host
  useEffect(() => {
    if (!playerRef.current || !isOpen || typeof currentTime !== "number" || currentTime <= 0) {
      return;
    }

    try {
      if (typeof playerRef.current.getCurrentTime === "function") {
        const localTime = playerRef.current.getCurrentTime() || 0;
        const drift = Math.abs(localTime - currentTime);
        setLastSyncDrift(Math.round(drift * 10) / 10);

        // If drift exceeds 2.0 seconds, auto-seek to match TV Host
        if (drift > 2.0) {
          console.log(
            `[PocketVideoMirror] Drift detected (${drift.toFixed(2)}s). Resyncing to TV: ${currentTime.toFixed(1)}s`
          );
          playerRef.current.seekTo(currentTime, true);
          setIsSynced(true);
        }
      }
    } catch (err) {
      console.warn("[PocketVideoMirror] Drift check error:", err);
    }
  }, [currentTime, isOpen]);

  // 4. Force Manual Resync
  const handleForceResync = useCallback(() => {
    if (playerRef.current && typeof currentTime === "number") {
      try {
        playerRef.current.seekTo(currentTime, true);
        if (isPlaying) playerRef.current.playVideo();
        setIsSynced(true);
      } catch (e) {
        console.warn(e);
      }
    }
  }, [currentTime, isPlaying]);

  // 5. Toggle Fullscreen
  const handleToggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => { });
      setIsNativeFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => { });
      setIsNativeFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  if (!isOpen) return null;

  // Mini View (Floating bottom-right player)
  if (isMiniView) {
    return (
      <div className="fixed bottom-20 right-3 z-50 w-72 bg-slate-950/95 border-2 border-purple-500/60 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
        <div className="flex items-center justify-between px-3 py-1.5 bg-purple-950/80 border-b border-purple-800/40 text-[11px] font-bold text-purple-200">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="truncate">{currentSong ? currentSong.title : "Màn hình phụ"}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setIsMiniView(false)}
              className="p-1 hover:text-white rounded transition"
              title="Phóng to rạp chiếu"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:text-rose-400 rounded transition"
              title="Đóng màn hình phụ"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Video Area */}
        <div className="aspect-video w-full bg-black relative">
          {currentSong?.youtubeId ? (
            <YouTube
              videoId={currentSong.youtubeId}
              opts={{
                width: "100%",
                height: "100%",
                playerVars: {
                  autoplay: 1,
                  controls: 0,
                  mute: 1, // STRICT 100% MUTED
                  modestbranding: 1,
                  rel: 0,
                  playsinline: 1,
                  iv_load_policy: 3,
                },
              }}
              onReady={(event) => {
                playerRef.current = event.target;
                event.target.mute();
                event.target.setVolume(0);
                if (currentTime > 0) {
                  event.target.seekTo(currentTime, true);
                }
                if (isPlaying) {
                  event.target.playVideo();
                } else {
                  event.target.pauseVideo();
                }
              }}
              className="w-full h-full object-cover pointer-events-none"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-slate-400 text-xs">
              <Tv className="w-6 h-6 mb-1 text-slate-500" />
              <span>Chưa có bài đang phát</span>
            </div>
          )}

          {/* Muted Watermark Badge */}
          <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-[9px] font-medium text-slate-300 flex items-center gap-1 pointer-events-none">
            <VolumeX className="w-3 h-3 text-amber-400" />
            <span>Muted</span>
          </div>
        </div>
      </div>
    );
  }

  // Fullscreen / Theater View
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col animate-in fade-in duration-200 select-none"
    >
      {/* 1. TOP CONTROL BAR */}
      <div className="px-4 py-3 bg-gradient-to-b from-slate-950 via-slate-900/90 to-transparent border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
            <Tv className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm font-bold text-white truncate">
                Màn Hình Phụ Bỏ Túi (Live Mirror)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Đồng bộ TV
              </span>
            </div>
            <p className="text-[10px] md:text-xs text-amber-400/90 flex items-center gap-1 truncate font-medium">
              <VolumeX className="w-3 h-3 shrink-0 text-amber-400" />
              <span>Đã tự động tắt tiếng (Âm thanh phát từ dàn loa TV để không bị trễ)</span>
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Switch to Synchronized Lyrics Button */}
          {onSwitchToLyrics && (
            <button
              onClick={onSwitchToLyrics}
              className="p-2 rounded-xl bg-purple-950/80 hover:bg-purple-900 text-purple-300 hover:text-white border border-purple-700/60 transition active:scale-95 flex items-center gap-1 text-xs"
              title="Chuyển sang chế độ Teleprompter lời bài hát"
            >
              <FileText className="w-3.5 h-3.5 text-purple-300" />
              <span className="hidden sm:inline text-[11px] font-bold">Xem Lời</span>
            </button>
          )}

          {/* Manual Resync Button */}
          <button
            onClick={handleForceResync}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95 flex items-center gap-1 text-xs"
            title="Đồng bộ lại với TV"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline text-[11px]">Đồng bộ ({lastSyncDrift}s)</span>
          </button>

          {/* Minimize into Floating PiP Button */}
          <button
            onClick={() => setIsMiniView(true)}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95"
            title="Thu nhỏ thành khung nổi góc màn hình"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Native Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition active:scale-95"
            title={isNativeFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình / Xoay ngang"}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/40 transition active:scale-95"
            title="Đóng màn hình phụ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN THEATER STAGE */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 md:p-6 min-h-0 relative">
        <div className="w-full max-w-4xl aspect-video bg-slate-950 rounded-2xl md:rounded-3xl overflow-hidden border border-slate-800 shadow-[0_0_50px_rgba(168,85,247,0.15)] relative flex items-center justify-center">
          {currentSong?.youtubeId ? (
            <div className="w-full h-full relative">
              <YouTube
                videoId={currentSong.youtubeId}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: {
                    autoplay: 1,
                    controls: 1, // Allow viewing full progress and subtitle toggle if needed
                    mute: 1, // STRICT 100% MUTED TO PREVENT ECHO
                    modestbranding: 1,
                    rel: 0,
                    playsinline: 1,
                    iv_load_policy: 3,
                  },
                }}
                onReady={(event) => {
                  playerRef.current = event.target;
                  event.target.mute();
                  event.target.setVolume(0);
                  if (currentTime > 0) {
                    event.target.seekTo(currentTime, true);
                  }
                  if (isPlaying) {
                    event.target.playVideo();
                  } else {
                    event.target.pauseVideo();
                  }
                }}
                className="w-full h-full object-cover"
              />

              {/* Pause Indicator overlay if TV paused */}
              {!isPlaying && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 pointer-events-none">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-2 animate-pulse">
                    <Tv className="w-6 h-6 text-amber-400" />
                  </div>
                  <p className="text-white font-bold text-sm">TV Host đang tạm dừng bài hát</p>
                  <p className="text-xs text-slate-400">Hình ảnh sẽ tiếp tục chạy khi TV tiếp tục phát</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Tv className="w-8 h-8 animate-pulse" />
              </div>
              <h3 className="text-lg font-bold text-white">Chưa có bài hát nào đang phát</h3>
              <p className="text-xs text-slate-400 max-w-sm">
                Hãy chọn một bài hát từ danh sách tìm kiếm hoặc hàng đợi để bắt đầu buổi hát Karaoke!
              </p>
            </div>
          )}
        </div>

        {/* Current Song Meta Under Player */}
        {currentSong && (
          <div className="w-full max-w-4xl mt-3 px-2 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <h4 className="font-extrabold text-white text-sm md:text-base truncate">
                {currentSong.title}
              </h4>
              <p className="text-purple-300 text-[11px] truncate">
                Người đặt bài: <b className="text-yellow-300">{currentSong.requestedBy || "Khách"}</b>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="px-2.5 py-1 rounded-xl bg-purple-950/60 border border-purple-700/50 text-purple-300 font-mono text-xs">
                Màn hình phụ • HD 1080p
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM CHEER & REACTION BAR (Cho phép vừa xem vừa tương tác bắn hiệu ứng) */}
      <div className="px-4 py-3 bg-slate-950/90 border-t border-slate-900 flex items-center justify-between gap-3 shrink-0">
        <div className="text-xs text-slate-400 hidden sm:flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Bắn tương tác lên màn hình TV:</span>
        </div>

        {/* Quick Reaction Buttons */}
        <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => onSendReaction?.("applause")}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            title="Vỗ tay cổ vũ"
          >
            <span>👏</span>
            <span className="text-[11px]">Vỗ tay</span>
          </button>

          <button
            onClick={() => onSendReaction?.("cheer")}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            title="Cổ vũ"
          >
            <span>🎉</span>
            <span className="text-[11px]">Cổ vũ</span>
          </button>

          <button
            onClick={() => onSendReaction?.("heart")}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            title="Thả tim"
          >
            <span>💖</span>
            <span className="text-[11px]">Thả tim</span>
          </button>

          <button
            onClick={() => onSendReaction?.("whistle")}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            title="Huýt sáo cổ vũ"
          >
            <span>📣</span>
            <span className="text-[11px]">Huýt sáo</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="hidden sm:inline-block px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition"
        >
          Xong
        </button>
      </div>
    </div>
  );
}