"use client";

import React, { useState } from "react";
import { Cast, Tv, Wifi } from "lucide-react";

export type CastStatus = "disconnected" | "connecting" | "connected";

interface CastButtonProps {
  status: CastStatus;
  tvName?: string;
  roomId?: string;
  pingMs?: number | null;
  variant?: "header" | "player" | "nav" | "compact";
  onClick: () => void;
  className?: string;
}

export default function CastButton({
  status,
  tvName = "TV Phòng",
  roomId,
  pingMs,
  variant = "player",
  onClick,
  className = "",
}: CastButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const displayTvName = tvName || (roomId ? `TV Phòng ${roomId}` : "TV");

  // Format tooltip text
  const tooltipText =
    status === "connected"
      ? `Đang phát trên: ${displayTvName}${pingMs ? ` (${pingMs}ms)` : ""}`
      : status === "connecting"
      ? "Đang kết nối TV..."
      : "Phát trên TV (Chưa kết nối)";

  // 1. HEADER VARIANT
  if (variant === "header") {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={onClick}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          aria-label={tooltipText}
          className={`relative flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer active:scale-95 ${
            status === "connected"
              ? "bg-emerald-950/80 hover:bg-emerald-900/90 border border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-900/30"
              : status === "connecting"
              ? "bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 animate-pulse shadow-sm shadow-cyan-900/30"
              : "bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200"
          } ${className}`}
        >
          {/* Cast Icon with status styling */}
          <div className="relative flex items-center justify-center">
            <Cast
              className={`w-3.5 h-3.5 transition-colors ${
                status === "connected"
                  ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                  : status === "connecting"
                  ? "text-cyan-400 animate-pulse"
                  : "text-slate-400"
              }`}
            />
            {/* Disconnected diagonal slash overlay */}
            {status === "disconnected" && (
              <span className="absolute w-[18px] h-[1.5px] bg-slate-500 rotate-45 transform origin-center rounded-full pointer-events-none opacity-80" />
            )}
            {/* Connecting pulsing ring */}
            {status === "connecting" && (
              <span className="absolute -inset-1 rounded-full border border-cyan-400 animate-ping opacity-60" />
            )}
          </div>

          {/* Connected TV Online dot indicator */}
          {status === "connected" && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          )}

          {/* Label */}
          <span className="max-w-[85px] truncate font-medium text-[11px]">
            {status === "connected" ? displayTvName : status === "connecting" ? "Đang kết nối" : "Phát TV"}
          </span>
        </button>

        {/* Hover / Active Tooltip */}
        {showTooltip && (
          <div className="absolute top-full right-0 mt-1.5 z-50 px-2.5 py-1 bg-slate-900/95 backdrop-blur-md text-slate-200 border border-slate-700/80 text-[10px] rounded-lg shadow-xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95">
            {tooltipText}
          </div>
        )}
      </div>
    );
  }

  // 2. BOTTOM NAVIGATION BAR VARIANT
  if (variant === "nav") {
    return (
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all cursor-pointer relative ${
          status === "connected"
            ? "text-emerald-400 font-bold"
            : status === "connecting"
            ? "text-cyan-400 font-bold animate-pulse"
            : "text-slate-400 hover:text-slate-200"
        } ${className}`}
      >
        <div className="relative flex items-center justify-center">
          <Cast
            className={`w-4 h-4 transition-all ${
              status === "connected"
                ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)] scale-110"
                : status === "connecting"
                ? "text-cyan-400 animate-pulse"
                : "text-slate-400"
            }`}
          />
          {status === "disconnected" && (
            <span className="absolute w-[18px] h-[1.5px] bg-slate-500 rotate-45 transform origin-center rounded-full pointer-events-none opacity-80" />
          )}
          {status === "connecting" && (
            <span className="absolute -inset-1 rounded-full border border-cyan-400 animate-ping opacity-60" />
          )}
          {status === "connected" && (
            <span className="absolute -top-1 -right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          )}
        </div>
        <span className="text-[10px] whitespace-nowrap">
          {status === "connected" ? "Đã phát TV" : "Phát TV"}
        </span>
      </button>
    );
  }

  // 3. COMPACT VARIANT (for small toolbars)
  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={tooltipText}
        className={`relative p-2 rounded-xl transition-all cursor-pointer active:scale-95 flex items-center justify-center ${
          status === "connected"
            ? "bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-900/30"
            : status === "connecting"
            ? "bg-cyan-950/70 border border-cyan-500/50 text-cyan-300 animate-pulse shadow-sm shadow-cyan-900/30"
            : "bg-slate-800/80 hover:bg-slate-750 border border-slate-700/60 text-slate-400 hover:text-slate-200"
        } ${className}`}
      >
        <Cast
          className={`w-4 h-4 ${
            status === "connected"
              ? "text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.7)]"
              : status === "connecting"
              ? "text-cyan-400"
              : "text-slate-400"
          }`}
        />
        {status === "disconnected" && (
          <span className="absolute w-[18px] h-[1.5px] bg-slate-500 rotate-45 transform origin-center rounded-full pointer-events-none opacity-80" />
        )}
        {status === "connected" && (
          <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
        )}
      </button>
    );
  }

  // 4. PLAYER BAR VARIANT (Adjacent to Play/Pause in bottom mini-player)
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={tooltipText}
        className={`group relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer active:scale-95 border ${
          status === "connected"
            ? "bg-gradient-to-r from-emerald-950/90 to-teal-950/90 hover:from-emerald-900 hover:to-teal-900 border-emerald-500/60 text-emerald-300 shadow-md shadow-emerald-950/40"
            : status === "connecting"
            ? "bg-cyan-950/90 border-cyan-500/60 text-cyan-300 animate-pulse shadow-md shadow-cyan-950/40"
            : "bg-slate-800/90 hover:bg-slate-750 border-slate-700/60 text-slate-300 hover:text-white"
        } ${className}`}
      >
        {/* Cast Icon with glowing waves */}
        <div className="relative flex items-center justify-center">
          <Cast
            className={`w-4 h-4 transition-transform group-hover:scale-110 ${
              status === "connected"
                ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.7)]"
                : status === "connecting"
                ? "text-cyan-400 animate-pulse"
                : "text-slate-400 group-hover:text-slate-200"
            }`}
          />
          {/* Disconnected strike-through */}
          {status === "disconnected" && (
            <span className="absolute w-5 h-[1.5px] bg-slate-500 rotate-45 transform origin-center rounded-full pointer-events-none opacity-80" />
          )}
          {/* Connecting pulse ring */}
          {status === "connecting" && (
            <span className="absolute -inset-1 rounded-full border border-cyan-400 animate-ping opacity-60" />
          )}
        </div>

        {/* Status text or TV Name indicator */}
        <div className="flex flex-col text-left leading-tight pr-0.5">
          <div className="flex items-center gap-1">
            <span
              className={`text-[11px] font-bold tracking-tight ${
                status === "connected"
                  ? "text-emerald-300"
                  : status === "connecting"
                  ? "text-cyan-300"
                  : "text-slate-300"
              }`}
            >
              {status === "connected" ? "Phát TV" : status === "connecting" ? "Kết nối..." : "Phát TV"}
            </span>
            {status === "connected" && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
              </span>
            )}
          </div>
          {status === "connected" && (
            <span className="text-[9px] text-emerald-400/80 font-mono truncate max-w-[65px]">
              {displayTvName}
            </span>
          )}
        </div>
      </button>

      {/* Floating Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 px-3 py-1.5 bg-slate-900/95 backdrop-blur-md text-slate-100 border border-slate-700/80 text-[11px] font-medium rounded-xl shadow-2xl whitespace-nowrap pointer-events-none animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-1.5">
            <Tv className="w-3.5 h-3.5 text-emerald-400" />
            <span>{tooltipText}</span>
          </div>
          <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700/80 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
        </div>
      )}
    </div>
  );
}
