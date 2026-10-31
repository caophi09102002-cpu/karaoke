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
      <div className="fixed bottom-20 right-3 z-50 w-72 bg-zinc-950/95 border border-white/[0.12] rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in slide-in-from-bottom-5 duration-200">
        <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-white/[0.08] text-[11px] font-medium text-zinc-200">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
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
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-zinc-500 text-xs">
              <Tv className="w-6 h-6 mb-1 text-zinc-600" />
              <span>Chưa có bài đang phát</span>
            </div>
          )}

          {/* Muted Watermark Badge */}
          <div className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-sm border border-white/10 text-[9px] font-mono text-zinc-400 flex items-center gap-1 pointer-events-none">
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
      <div className="px-4 py-3 bg-zinc-950/90 border-b border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-200 shrink-0">
            <Tv className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs md:text-sm font-semibold text-white truncate">
                Màn hình phụ (Live Mirror)
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Đồng bộ TV
              </span>
            </div>
            <p className="text-[10px] md:text-xs text-zinc-400 flex items-center gap-1 truncate font-normal">
              <VolumeX className="w-3 h-3 shrink-0 text-amber-400" />
              <span>Đã tắt tiếng (Âm thanh phát từ dàn loa TV để không bị trễ)</span>
            </p>
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Switch to Synchronized Lyrics Button */}
          {onSwitchToLyrics && (
            <button
              onClick={onSwitchToLyrics}
              className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-white/[0.08] transition active:scale-95 flex items-center gap-1 text-xs"
              title="Chuyển sang chế độ Teleprompter lời bài hát"
            >
              <FileText className="w-3.5 h-3.5 text-zinc-300" />
              <span className="hidden sm:inline text-[11px] font-medium">Xem lời</span>
            </button>
          )}

          {/* Manual Resync Button */}
          <button
            onClick={handleForceResync}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.08] transition active:scale-95 flex items-center gap-1 text-xs"
            title="Đồng bộ lại với TV"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline text-[11px] font-mono">Đồng bộ ({lastSyncDrift}s)</span>
          </button>

          {/* Minimize into Floating PiP Button */}
          <button
            onClick={() => setIsMiniView(true)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.08] transition active:scale-95"
            title="Thu nhỏ thành khung nổi góc màn hình"
          >
            <Minimize2 className="w-4 h-4" />
          </button>

          {/* Native Fullscreen Toggle */}
          <button
            onClick={handleToggleFullscreen}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.08] transition active:scale-95"
            title={isNativeFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình / Xoay ngang"}
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-white border border-rose-500/20 transition active:scale-95"
            title="Đóng màn hình phụ"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. MAIN THEATER STAGE */}
      <div className="flex-1 flex flex-col items-center justify-center p-2 md:p-6 min-h-0 relative">
        <div className="w-full max-w-4xl aspect-video bg-zinc-950 rounded-2xl md:rounded-3xl overflow-hidden border border-white/[0.1] shadow-2xl relative flex items-center justify-center">
          {currentSong?.youtubeId ? (
            <div className="w-full h-full relative">
              <YouTube
                videoId={currentSong.youtubeId}
                opts={{
                  width: "100%",
                  height: "100%",
                  playerVars: {
                    autoplay: 1,
                    controls: 1,
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
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-white/[0.1] flex items-center justify-center mb-2">
                    <Tv className="w-6 h-6 text-zinc-300" />
                  </div>
                  <p className="text-white font-medium text-sm">TV Host đang tạm dừng bài hát</p>
                  <p className="text-xs text-zinc-400 mt-0.5">Hình ảnh sẽ tiếp tục chạy khi TV tiếp tục phát</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/[0.08] flex items-center justify-center text-zinc-400">
                <Tv className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-white">Chưa có bài hát nào đang phát</h3>
              <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
                Hãy chọn một bài hát từ danh sách tìm kiếm hoặc hàng đợi để bắt đầu buổi hát Karaoke!
              </p>
            </div>
          )}
        </div>

        {/* Current Song Meta Under Player */}
        {currentSong && (
          <div className="w-full max-w-4xl mt-3 px-2 flex items-center justify-between gap-3 text-xs">
            <div className="min-w-0">
              <h4 className="font-semibold text-white text-sm md:text-base truncate">
                {currentSong.title}
              </h4>
              <p className="text-zinc-400 text-[11px] truncate mt-0.5">
                Người đặt: <span className="text-zinc-200 font-medium">{currentSong.requestedBy || "Khách"}</span>
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 border border-white/[0.08] text-zinc-300 font-mono text-[11px]">
                Màn hình phụ • HD
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM CHEER & REACTION BAR */}
      <div className="px-4 py-3 bg-zinc-950/90 border-t border-white/[0.08] flex items-center justify-between gap-3 shrink-0">
        <div className="text-xs text-zinc-400 hidden sm:flex items-center gap-1.5 font-medium">
          <span>Bắn cảm xúc lên TV:</span>
        </div>

        {/* Quick Reaction Buttons */}
        <div className="flex items-center justify-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => onSendReaction?.("applause")}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] text-white font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            title="Vỗ tay cổ vũ"
          >
            <span>👏</span>
            <span className="text-[11px]">Vỗ tay</span>
          </button>

          <button
            onClick={() => onSendReaction?.("cheer")}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] text-white font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            title="Cổ vũ"
          >
            <span>🎉</span>
            <span className="text-[11px]">Cổ vũ</span>
          </button>

          <button
            onClick={() => onSendReaction?.("heart")}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] text-white font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            title="Thả tim"
          >
            <span>💖</span>
            <span className="text-[11px]">Thả tim</span>
          </button>

          <button
            onClick={() => onSendReaction?.("whistle")}
            className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/[0.06] text-white font-medium text-xs flex items-center justify-center gap-1.5 active:scale-95 transition"
            title="Huýt sáo cổ vũ"
          >
            <span>📣</span>
            <span className="text-[11px]">Huýt sáo</span>
          </button>
        </div>

        <button
          onClick={onClose}
          className="hidden sm:inline-block px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition cursor-pointer"
        >
          Xong
        </button>
      </div>
    </div>
  );
}