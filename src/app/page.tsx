"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { generateRoomId } from "@/lib/room-utils";
import {
  Mic2,
  Tv,
  Smartphone,
  PlusCircle,
  ArrowRight,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Handle "Tạo phòng hát mới" -> sinh mã phòng 6 ký tự -> chuyển hướng đến /room/[roomId]/host
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-rose-500 selection:text-white relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute -bottom-32 right-1/4 w-[600px] h-[600px] bg-rose-600/15 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="max-w-6xl w-full mx-auto px-6 py-6 flex items-center justify-between border-b border-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-rose-500 to-purple-600 rounded-2xl text-white shadow-xl shadow-rose-500/25">
            <Mic2 className="w-6 h-6" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
              KARAOKE DUAL-SCREEN
            </span>
            <div className="text-[11px] text-slate-400 font-mono tracking-wider">
              REAL-TIME SYNC ENGINE
            </div>
          </div>
        </div>

        <Link
          href="/test-socket"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium transition-all"
        >
          <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
          <span>Test Socket</span>
        </Link>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-12 flex-1 flex flex-col items-center justify-center text-center space-y-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-rose-500/10 via-purple-500/10 to-indigo-500/10 border border-rose-500/20 text-rose-300 text-xs font-semibold backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-rose-400" />
          Hệ thống Karaoke Hai Màn hình Thời gian thực
        </div>

        <div className="space-y-4">
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Biến phòng khách thành{" "}
            <span className="bg-gradient-to-r from-rose-500 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              Sân khấu Karaoke
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
            Màn hình TV hiển thị lời bài hát với mã QR kết nối. Điện thoại đóng vai trò bộ điều khiển tìm kiếm, chọn bài và bắn hiệu ứng vỗ tay reo hò theo thời gian thực.
          </p>
        </div>

        {/* Primary Action: Tạo phòng hát mới */}
        <div className="w-full max-w-md space-y-6">
          <button
            onClick={handleCreateNewRoom}
            disabled={isCreating}
            className="w-full group cursor-pointer relative px-8 py-5 rounded-2xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-bold text-lg shadow-2xl shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <PlusCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
            <span>{isCreating ? "Đang tạo phòng..." : "Tạo phòng hát mới"}</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>

          <div className="flex items-center gap-4 text-xs text-slate-500 uppercase tracking-wider font-semibold">
            <span className="flex-1 h-px bg-slate-800" />
            <span>hoặc tham gia phòng có sẵn</span>
            <span className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Quick Join as Controller */}
          <form onSubmit={handleJoinAsController} className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Nhập mã phòng (VD: KARA88)"
              maxLength={10}
              className="flex-1 bg-slate-900/90 border border-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 rounded-xl px-4 py-3 text-sm font-mono text-center tracking-wider text-white uppercase placeholder:text-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!joinCode.trim()}
              className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border border-slate-700"
            >
              <Smartphone className="w-4 h-4 text-purple-400" />
              <span>Vào điều khiển</span>
            </button>
          </form>
        </div>

        {/* Architecture Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl pt-6">
          <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl flex items-center gap-4 text-left">
            <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
              <Tv className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Màn hình Host (TV)</div>
              <div className="text-xs text-slate-400">
                Hiển thị video, mã QR kết nối và số điện thoại đang tham gia.
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-900/50 border border-slate-800/80 rounded-2xl flex items-center gap-4 text-left">
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Điện thoại Controller</div>
              <div className="text-xs text-slate-400">
                Quét mã QR để điều khiển chọn bài, ưu tiên và gửi soundboard.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto px-6 py-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
        <span>KARAOKE DUAL-SCREEN • Real-time Web Platform</span>
        <span className="flex items-center gap-1.5">
          <Zap className="w-3 h-3 text-emerald-400" />
          Next.js App Router + Socket.IO In-Memory State
        </span>
      </footer>
    </div>
  );
}
