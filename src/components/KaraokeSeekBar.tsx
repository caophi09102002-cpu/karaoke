"use client";

import React, { useState, useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { TimeUpdatePayload } from "@/types/socket";

interface KaraokeSeekBarProps {
  roomId: string;
  disabled?: boolean;
}

/**
 * Format seconds into mm:ss
 */
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export default function KaraokeSeekBar({ roomId, disabled = false }: KaraokeSeekBarProps) {
  // Current playback time and total duration synchronized from Host
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Anti-jitter Dragging state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragTime, setDragTime] = useState<number>(0);

  const isDraggingRef = useRef<boolean>(false);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDragTimeRef = useRef<number>(0);

  // Synchronize playback progress from Host TV via socket
  useEffect(() => {
    if (!roomId) return;
    const socket = getSocket();

    const onTimeUpdate = (data: TimeUpdatePayload) => {
      if (data.roomId === roomId) {
        // Only update current time if user is NOT currently dragging the scrubber
        if (!isDraggingRef.current) {
          setCurrentTime(data.currentTime || 0);
        }
        if (typeof data.duration === "number" && data.duration > 0) {
          setDuration(data.duration);
        }
      }
    };

    socket.on("host:time-update", onTimeUpdate);

    return () => {
      socket.off("host:time-update", onTimeUpdate);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, [roomId]);

  // Touch & Mouse Scrubbing Handlers
  const handleStart = () => {
    if (disabled || duration <= 0) return;
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    isDraggingRef.current = true;
    setIsDragging(true);
    setDragTime(currentTime);
    latestDragTimeRef.current = currentTime;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || duration <= 0) return;
    const val = parseFloat(e.target.value);
    setDragTime(val);
    latestDragTimeRef.current = val;
  };

  const handleEnd = () => {
    if (!isDraggingRef.current) return;
    const target = latestDragTimeRef.current;

    // Send remote seek event to TV Host
    const socket = getSocket();
    socket.emit("client:seek-to", {
      roomId,
      targetTime: target,
    });

    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    // 300ms debounce buffer so TV Host has time to seek and report back
    dragTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false;
      setIsDragging(false);
      setCurrentTime(target);
    }, 300);
  };

  // Determine display time and track fill percentage
  const displayTime = isDragging ? dragTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  return (
    <div className={`w-full flex flex-col gap-1 select-none ${disabled ? "opacity-40 pointer-events-none" : ""}`}>
      {/* Interactive Range Scrubber */}
      <div className="relative flex items-center w-full py-1">
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 100}
          step={0.5}
          value={displayTime}
          disabled={disabled || duration <= 0}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
          onChange={handleChange}
          onMouseUp={handleEnd}
          onTouchEnd={handleEnd}
          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-slate-800 outline-none transition-all
            [&::-webkit-slider-thumb]:appearance-none 
            [&::-webkit-slider-thumb]:w-4 
            [&::-webkit-slider-thumb]:h-4 
            [&::-webkit-slider-thumb]:rounded-full 
            [&::-webkit-slider-thumb]:bg-white 
            [&::-webkit-slider-thumb]:border-2 
            [&::-webkit-slider-thumb]:border-rose-500 
            [&::-webkit-slider-thumb]:shadow-lg 
            [&::-webkit-slider-thumb]:shadow-rose-500/50 
            [&::-webkit-slider-thumb]:transition-transform 
            [&::-webkit-slider-thumb]:hover:scale-125
            [&::-webkit-slider-thumb]:active:scale-150
            [&::-moz-range-thumb]:w-4 
            [&::-moz-range-thumb]:h-4 
            [&::-moz-range-thumb]:rounded-full 
            [&::-moz-range-thumb]:bg-white 
            [&::-moz-range-thumb]:border-2 
            [&::-moz-range-thumb]:border-rose-500 
            [&::-moz-range-thumb]:shadow-lg"
          style={{
            background: `linear-gradient(to right, #f43f5e 0%, #f43f5e ${progressPercent}%, #334155 ${progressPercent}%, #334155 100%)`,
          }}
          title={duration > 0 ? `Tua đến ${formatTime(displayTime)}` : "Đang tải video..."}
        />
      </div>

      {/* Time Labels (Current Time vs Total Duration) */}
      <div className="flex items-center justify-between text-[10px] font-mono leading-none px-0.5">
        <span
          className={`transition-colors font-semibold ${
            isDragging ? "text-rose-400 font-bold scale-110" : "text-slate-400"
          }`}
        >
          {formatTime(displayTime)}
          {isDragging && <span className="ml-1 text-[8px] uppercase tracking-wider text-rose-500">Tua</span>}
        </span>
        <span className="text-slate-500 font-medium">{formatTime(duration)}</span>
      </div>
    </div>
  );
}
