"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { generateRoomId } from "@/lib/room-utils";
import {
  Mic,
  Tv,
  Smartphone,
  Plus,
  ArrowRight,
  Radio,
  Sparkles,
  QrCode,
  Zap,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateNewRoom = () => {
    setIsCreating(true);
    const newRoomId = generateRoomId(6);
    router.push(`/room/${newRoomId}/host`);
  };

  const handleJoinAsController = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    router.push(`/room/${joinCode.trim().toUpperCase()}/controller`);
  };

  return (
    <div className="min-h-screen text-zinc-100 flex flex-col justify-between selection:bg-red-500/30 selection:text-white relative overflow-hidden bg-[#070002]">
      {/* 1. Dramatic Red Silk Wave Background Image (Always visible at z-0) */}
      <div
        className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/karaoke-bg-red.jpg')" }}
      >
        {/* Subtle vignette overlay so text is crisp without dimming the red waves */}
        <div className="absolute inset-0 bg-black/30 backdrop-brightness-95" />
      </div>

      {/* Top Header */}
      <header className="max-w-7xl w-full mx-auto px-6 py-5 flex items-center justify-between relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-500 border border-red-400/30 flex items-center justify-center text-white shadow-lg shadow-red-950/50">
            <Mic className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                KARAOKE STUDIO
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide bg-gradient-to-r from-red-500 to-amber-400 text-black">
                PRO
              </span>
            </div>
          </div>
        </div>

        {/* Center Pill Badge (Hidden on very small screens) */}
        <div className="hidden md:inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-950/70 border border-white/[0.08] text-zinc-300 text-xs font-medium backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Công nghệ đồng bộ hai màn hình TV &amp; Điện thoại</span>
        </div>

        <Link
          href="/test-socket"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/70 hover:bg-zinc-900 border border-white/[0.08] hover:border-red-500/40 text-zinc-300 text-xs font-medium transition-colors backdrop-blur-md"
        >
          <Radio className="w-3.5 h-3.5 text-red-400" />
          <span className="hidden sm:inline">Kiểm tra mạng</span>
        </Link>
      </header>

      {/* Main Hero Section: Two-Column Composition */}
      <main className="max-w-7xl w-full mx-auto px-6 pt-4 pb-0 flex-1 flex flex-col lg:flex-row items-stretch justify-between gap-8 lg:gap-12 relative z-10">
        {/* Left Column: Male Singer Anchored to Floor with Stage Fog & Billowing Smoke */}
        <div className="w-full lg:w-5/12 flex flex-col items-center justify-end self-end relative order-2 lg:order-1 pt-6 lg:pt-0">
          {/* Stage Atmosphere: Billowing Smoke Clouds & Concert Haze */}
          <div className="absolute inset-0 pointer-events-none overflow-visible flex items-end justify-center">
            {/* 1. Deep Red Ambient Glow Backdrop */}
            <div className="absolute top-1/4 -left-8 w-[340px] sm:w-[440px] h-[340px] sm:h-[440px] bg-red-600/35 rounded-full blur-[85px] animate-aura-pulse" />
            
            {/* 2. Main Stage Smoke Plume behind singer's back & torso (billowing leftwards) */}
            <div className="absolute top-16 -left-16 sm:-left-20 w-[280px] sm:w-[350px] h-[320px] sm:h-[400px] rounded-[45%_55%_65%_35%/50%_60%_40%_50%] bg-gradient-to-br from-red-500/40 via-rose-700/30 to-transparent blur-[50px] smoke-plume-1" />

            {/* 3. Secondary Fog Puff around head, neck & microphone */}
            <div className="absolute -top-4 left-6 sm:left-12 w-[220px] sm:w-[280px] h-[220px] sm:h-[280px] rounded-[55%_45%_40%_60%/40%_50%_50%_60%] bg-gradient-to-tr from-rose-400/30 via-red-600/25 to-transparent blur-[42px] smoke-plume-2" />

            {/* 4. Dense Stage Floor Mist (anchors the singer smoothly to the bottom) */}
            <div className="absolute -bottom-6 -left-12 -right-12 h-[200px] sm:h-[240px] rounded-[50%_50%_30%_30%/60%_60%_40%_40%] bg-gradient-to-t from-red-950/85 via-red-800/35 to-transparent blur-[48px] smoke-plume-bottom" />

            {/* 5. Radiant Core Smoke Highlight */}
            <div className="absolute top-28 left-4 w-[200px] h-[240px] rounded-[40%_60%_50%_50%/50%_40%_60%_50%] bg-gradient-to-r from-rose-200/25 via-red-500/30 to-transparent blur-[36px] smoke-plume-1" style={{ animationDelay: "-3.5s" }} />
          </div>

          {/* Singer Cutout with floating micro-motion & smooth gradient bottom fade */}
          <div className="relative z-10 max-w-[360px] sm:max-w-[440px] lg:max-w-[490px] xl:max-w-[520px] w-full flex items-end justify-center animate-singer-float">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/singer.png"
              alt="Karaoke Singer"
              className="w-full h-auto object-contain animate-red-glow select-none drop-shadow-[0_25px_50px_rgba(0,0,0,0.9)]"
              style={{
                WebkitMaskImage: "linear-gradient(to top, transparent 0%, rgba(0,0,0,0.25) 8%, rgba(0,0,0,0.85) 20%, black 32%, black 100%)",
                maskImage: "linear-gradient(to top, transparent 0%, rgba(0,0,0,0.25) 8%, rgba(0,0,0,0.85) 20%, black 32%, black 100%)",
              }}
              loading="eager"
            />
          </div>

          {/* Foreground Floor Smoke Veil: sweeps across the lower body to eliminate any hard lines */}
          <div className="absolute -bottom-6 -left-8 -right-8 h-28 pointer-events-none z-20 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-t from-[#070002] via-red-950/50 to-transparent blur-[25px] smoke-plume-bottom" style={{ animationDuration: "7.5s" }} />
          </div>
        </div>

        {/* Right Column: Hero Content & Room Controls (Centered vertically for perfect balance) */}
        <div className="w-full lg:w-7/12 flex flex-col items-center lg:items-start justify-center text-center lg:text-left space-y-6 order-1 lg:order-2 self-center py-6 lg:py-10">
          {/* Eyebrow badge for mobile */}
          <div className="md:hidden inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-950/70 border border-white/[0.08] text-zinc-300 text-xs font-medium backdrop-blur-md">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Đồng bộ thời gian thực &lt; 30ms</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight text-white leading-[1.15]">
            Trải nghiệm hát Karaoke{" "}
            <span className="block mt-1 sm:mt-2 text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-rose-400 to-amber-300 drop-shadow-[0_2px_20px_rgba(239,68,68,0.4)]">
              thông minh tại gia
            </span>
          </h1>

          <p className="max-w-xl text-zinc-300 text-sm sm:text-base leading-relaxed font-normal">
            Mở TV làm sân khấu chính, cùng điện thoại làm bàn chọn bài. Tận hưởng chất lượng âm thanh và hình ảnh đồng bộ tức thì không độ trễ.
          </p>

          {/* Action Row: Create Room Button + Join Room Code Form */}
          <div className="w-full max-w-xl pt-2 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Create Room Button with energetic crimson gradient */}
              <button
                onClick={handleCreateNewRoom}
                disabled={isCreating}
                className="group relative px-6 py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-sm sm:text-base transition-all duration-200 flex items-center justify-center gap-2.5 shadow-xl shadow-red-950/60 disabled:opacity-50 cursor-pointer active:scale-[0.98] shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>{isCreating ? "Đang chuẩn bị..." : "Tạo phòng TV mới"}</span>
                <ArrowRight className="w-4 h-4 text-white/80 group-hover:translate-x-1 transition-transform" />
              </button>

              {/* Join Code Input Form */}
              <form onSubmit={handleJoinAsController} className="flex-1 flex items-center gap-2">
                <div className="relative flex-1">
                  <QrCode className="w-4 h-4 text-zinc-500 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Mã phòng (VD: KARA88)"
                    maxLength={10}
                    className="w-full bg-zinc-950/80 border border-white/[0.12] focus:border-red-500/80 rounded-2xl pl-10 pr-3 py-3.5 text-sm font-mono tracking-wider text-white uppercase placeholder:text-zinc-500 placeholder:normal-case placeholder:tracking-normal focus:outline-none transition-colors backdrop-blur-md"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!joinCode.trim()}
                  className="px-4 py-3.5 rounded-2xl bg-zinc-900/90 hover:bg-zinc-800 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/[0.1] active:scale-95 shrink-0 backdrop-blur-md"
                >
                  <Smartphone className="w-4 h-4 text-red-400 stroke-[2]" />
                  <span className="hidden sm:inline">Vào điều khiển</span>
                </button>
              </form>
            </div>
          </div>

          {/* Feature Highlight Cards (2 Glassmorphic Cards like Image 3) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full max-w-xl pt-4 text-left">
            {/* TV Screen Card */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/[0.08] hover:border-red-500/30 transition-colors backdrop-blur-xl flex items-start gap-3.5 group">
              <div className="p-2.5 rounded-xl bg-red-600/10 border border-red-500/20 text-red-400 shrink-0 group-hover:scale-105 transition-transform">
                <Tv className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Màn hình TV (Host)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-red-400 transition-colors" />
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Phát video sắc nét, hiển thị mã QR để cả bàn quét chọn bài cùng lúc.
                </p>
              </div>
            </div>

            {/* Controller Card */}
            <div className="p-4 rounded-2xl bg-zinc-950/60 border border-white/[0.08] hover:border-red-500/30 transition-colors backdrop-blur-xl flex items-start gap-3.5 group">
              <div className="p-2.5 rounded-xl bg-purple-600/10 border border-purple-500/20 text-rose-400 shrink-0 group-hover:scale-105 transition-transform">
                <Smartphone className="w-5 h-5 stroke-[2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center justify-between">
                  <span>Điện thoại (Controller)</span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-rose-400 transition-colors" />
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  Tìm bài hát siêu tốc, quản lý hàng đợi và xem màn hình TV rõ nét.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl w-full mx-auto px-6 py-5 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-400 gap-2 font-normal relative z-20">
        <span className="font-medium tracking-tight text-zinc-400">
          KARAOKE STUDIO • Professional Dual-Screen System
        </span>
        <span className="flex items-center gap-1.5 text-red-400/90 font-medium font-mono text-[11px]">
          <Zap className="w-3.5 h-3.5 fill-red-400 text-red-400" />
          <span>Kết nối thời gian thực &lt; 30ms</span>
        </span>
      </footer>
    </div>
  );
}
