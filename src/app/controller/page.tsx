"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Heart,
  ListMusic,
  PartyPopper,
  Tv,
  ArrowLeft,
  Cast,
  CheckCircle2,
  Music,
  PlusCircle,
  Clock,
  Sparkles,
  QrCode,
  KeyRound,
  History,
  Lock,
} from "lucide-react";
import CastButton, { CastStatus } from "@/components/CastButton";
import CastDeviceModal from "@/components/CastDeviceModal";
import {
  getRecentDevices,
  saveRecentDevice,
  RecentDevice,
} from "@/lib/cast-storage";
import {
  FavoriteSong,
  getFavorites,
  toggleFavorite,
} from "@/lib/favorites";
import { YouTubeSearchResult } from "@/app/api/search-youtube/route";
import SearchBarWithAutocomplete from "@/components/SearchBarWithAutocomplete";

export default function StandaloneControllerPage() {
  const router = useRouter();

  // Navigation tab: 'search' | 'favorites' | 'queue' | 'soundboard'
  const [activeTab, setActiveTab] = useState<"search" | "favorites" | "queue" | "soundboard">("search");

  // Cast Modal state
  const [showCastModal, setShowCastModal] = useState(false);
  const [recentDevices, setRecentDevices] = useState<RecentDevice[]>([]);

  // YouTube Search States
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<YouTubeSearchResult[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Favorites States
  const [favorites, setFavorites] = useState<FavoriteSong[]>([]);

  // Load recent devices and favorites on mount
  useEffect(() => {
    setFavorites(getFavorites());
    const devices = getRecentDevices();
    setRecentDevices(devices);

    // If there is a last room visited recently within the last 15 mins, we can optionally suggest or prompt
    const lastRoom = localStorage.getItem("karaoke_last_room_id");
    if (lastRoom && devices.length > 0) {
      // Keep last room ready
    }
  }, []);

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

  // Execute YouTube Search via /api/search-youtube?q=...
  const handleSearch = async (overrideQuery?: string | React.FormEvent) => {
    if (overrideQuery && typeof overrideQuery !== "string") {
      overrideQuery.preventDefault();
    }
    const target = typeof overrideQuery === "string" ? overrideQuery : searchQuery;
    const query = target.trim();
    if (!query) return;

    setIsSearching(true);
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

  // When user tries to play/queue song while disconnected from TV
  const handleSelectSongPrompt = () => {
    showToast("📺 Vui lòng kết nối với màn hình TV để hát!");
    setShowCastModal(true);
  };

  // When user picks a room from modal
  const handleConnectRoom = (targetRoomId: string) => {
    if (!targetRoomId) return;
    saveRecentDevice(targetRoomId);
    router.push(`/room/${targetRoomId.toUpperCase()}/controller`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-rose-500 selection:text-white font-sans max-w-md mx-auto relative border-x border-slate-900 shadow-2xl pb-32">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-rose-600/15 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-emerald-500/90 text-white text-xs font-semibold rounded-full shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Mobile Sticky Top Header */}
      <header className="sticky top-0 z-40 px-3 py-2.5 bg-slate-950/95 backdrop-blur-xl border-b border-slate-900 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold font-mono tracking-wider text-rose-400">
                ĐIỀU KHIỂN KARAOKE
              </span>
            </div>
            <div className="text-[9px] text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Chưa kết nối TV</span>
            </div>
          </div>
        </div>

        {/* Cast to TV Button in Header */}
        <div className="flex items-center gap-1.5 shrink-0">
          <CastButton
            variant="header"
            status="disconnected"
            onClick={() => setShowCastModal(true)}
          />
        </div>
      </header>

      {/* Standalone TV Connect Callout Banner */}
      <div className="p-4 bg-gradient-to-r from-rose-950/40 via-purple-950/40 to-slate-900 border-b border-slate-800/80">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold">
              <Sparkles className="w-3 h-3 text-rose-400" />
              Chế độ chuẩn bị bài
            </div>
            <h2 className="text-sm font-extrabold text-white">
              Chưa kết nối màn hình TV
            </h2>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Bấm nút <span className="text-emerald-400 font-bold">Phát trên TV</span> để nhập mã PIN 6 số hoặc quét mã QR trên TV.
            </p>
          </div>

          <button
            onClick={() => setShowCastModal(true)}
            className="px-3 py-2 bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-950/40 flex items-center gap-1.5 shrink-0 transition-transform active:scale-95 cursor-pointer"
          >
            <Cast className="w-3.5 h-3.5" />
            <span>Kết nối</span>
          </button>
        </div>

        {/* Quick Recent Devices shortcuts if available */}
        {recentDevices.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] text-slate-400 shrink-0 font-medium">
              TV gần đây:
            </span>
            {recentDevices.slice(0, 3).map((dev) => (
              <button
                key={dev.roomId}
                onClick={() => handleConnectRoom(dev.roomId)}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white rounded-lg text-[10px] font-mono flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
              >
                <Tv className="w-2.5 h-2.5 text-rose-400" />
                <span>{dev.name || dev.roomId}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Tab Content */}
      {activeTab === "search" && (
        <main className="flex-1 p-4 space-y-4">
          {/* Smart Search Bar with Autocomplete Suggestions */}
          <SearchBarWithAutocomplete
            query={searchQuery}
            onChangeQuery={setSearchQuery}
            onSearch={(q) => handleSearch(q)}
            isSearching={isSearching}
            placeholder="Tìm bài hát hoặc viết tắt (VD: 'cdns', 'Cắt đôi...')"
          />

          {/* Search Results List */}
          {searchResults.length > 0 ? (
            <div className="space-y-2.5">
              <div className="text-xs text-slate-400 font-semibold px-1">
                Kết quả tìm kiếm ({searchResults.length} bài):
              </div>
              <div className="space-y-2">
                {searchResults.map((song) => {
                  const isFav = favorites.some((f) => f.youtubeId === song.youtubeId);
                  return (
                    <div
                      key={song.youtubeId}
                      className="p-3 bg-slate-900/90 hover:bg-slate-850 border border-slate-800/90 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <img
                          src={song.thumbnail}
                          alt={song.title}
                          className="w-12 h-12 object-cover rounded-xl shrink-0 border border-slate-800"
                        />
                        <div className="overflow-hidden flex-1">
                          <h4 className="text-xs font-bold text-white truncate">
                            {song.title}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {song.channelTitle} • {song.duration}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) =>
                            handleToggleFavorite(
                              {
                                youtubeId: song.youtubeId,
                                title: song.title,
                                channelTitle: song.channelTitle,
                                thumbnail: song.thumbnail,
                                duration: song.duration,
                              },
                              e
                            )
                          }
                          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                            isFav
                              ? "bg-rose-500/20 border-rose-500/40 text-rose-400"
                              : "bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white"
                          }`}
                          title={isFav ? "Xóa khỏi bài tủ" : "Lưu vào bài tủ"}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-rose-400" : ""}`} />
                        </button>

                        <button
                          type="button"
                          onClick={handleSelectSongPrompt}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Hát</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-900 rounded-3xl space-y-3">
              <Music className="w-10 h-10 text-slate-600 mx-auto" />
              <div className="text-sm font-bold text-slate-300">
                Tìm kiếm hàng triệu bài Karaoke
              </div>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Nhập tên bài hát hoặc ký tự viết tắt để chuẩn bị danh sách bài hát yêu thích trước khi kết nối TV.
              </p>
            </div>
          )}
        </main>
      )}

      {/* Favorites Tab */}
      {activeTab === "favorites" && (
        <main className="flex-1 p-4 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-bold text-white">Bài tủ của bạn ({favorites.length})</span>
            <span>Lưu trên máy này</span>
          </div>

          {favorites.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/40 border border-slate-900 rounded-3xl space-y-3">
              <Heart className="w-10 h-10 text-rose-500/40 mx-auto" />
              <div className="text-sm font-bold text-slate-300">
                Chưa có bài tủ nào
              </div>
              <p className="text-xs text-slate-500">
                Tìm bài hát và bấm vào biểu tượng trái tim để lưu lại bài bạn thích nhất.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {favorites.map((song) => (
                <div
                  key={song.youtubeId}
                  className="p-3 bg-slate-900/90 hover:bg-slate-850 border border-slate-800/90 rounded-2xl flex items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <img
                      src={song.thumbnail}
                      alt={song.title}
                      className="w-12 h-12 object-cover rounded-xl shrink-0 border border-slate-800"
                    />
                    <div className="overflow-hidden flex-1">
                      <h4 className="text-xs font-bold text-white truncate">
                        {song.title}
                      </h4>
                      <p className="text-[10px] text-slate-400 truncate">
                        {song.artist} {song.duration && `• ${song.duration}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(song)}
                      className="p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 cursor-pointer"
                      title="Xóa khỏi bài tủ"
                    >
                      <Heart className="w-3.5 h-3.5 fill-rose-400" />
                    </button>

                    <button
                      type="button"
                      onClick={handleSelectSongPrompt}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Hát</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* Queue & Soundboard Tab Placeholders in Standalone Mode */}
      {(activeTab === "queue" || activeTab === "soundboard") && (
        <main className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl text-rose-400 shadow-xl">
            <Tv className="w-10 h-10 animate-pulse" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              Cần kết nối với màn hình TV
            </h3>
            <p className="text-xs text-slate-400 max-w-xs">
              {activeTab === "queue"
                ? "Hàng đợi phát nhạc được đồng bộ trực tiếp với màn hình TV Host."
                : "Tính năng gửi vỗ tay, pháo hoa và bắn chữ Danmaku cần kết nối TV để hiển thị."}
            </p>
          </div>
          <button
            onClick={() => setShowCastModal(true)}
            className="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-purple-600 text-white text-xs font-bold rounded-2xl shadow-xl shadow-rose-950/40 flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <Cast className="w-4 h-4" />
            <span>Phát trên TV ngay</span>
          </button>
        </main>
      )}

      {/* Pinned Mini Player Bar (Visible Across All Tabs) */}
      <div className="fixed bottom-14 left-0 right-0 max-w-md mx-auto px-3 py-2 z-30">
        <div className="p-3 bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-hidden flex-1">
            <div className="p-2 bg-gradient-to-tr from-slate-700 to-slate-800 rounded-xl text-slate-400 shrink-0">
              <Music className="w-4 h-4" />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-extrabold text-slate-300 truncate">
                Chưa kết nối màn hình TV
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                Bấm nút Phát TV bên cạnh để đồng bộ
              </div>
            </div>
          </div>

          {/* Quick Remote Controls with CastButton adjacent to Play/Pause */}
          <div className="flex items-center gap-1.5 shrink-0">
            <CastButton
              variant="player"
              status="disconnected"
              onClick={() => setShowCastModal(true)}
            />
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-950/95 backdrop-blur-2xl border-t border-slate-900 p-2 flex items-center justify-around text-xs text-slate-400 z-40">
        <button
          onClick={() => setActiveTab("search")}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            activeTab === "search" ? "text-rose-400 font-bold" : "hover:text-slate-200"
          }`}
        >
          <Search className="w-4 h-4" />
          <span className="text-[10px]">Tìm bài</span>
        </button>

        <button
          onClick={() => setActiveTab("favorites")}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer relative ${
            activeTab === "favorites" ? "text-rose-400 font-bold" : "hover:text-slate-200"
          }`}
        >
          <Heart className={`w-4 h-4 ${activeTab === "favorites" ? "fill-rose-400" : ""}`} />
          <span className="text-[10px]">Bài tủ</span>
          {favorites.length > 0 && (
            <span className="absolute top-0 right-1.5 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
              {favorites.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab("queue")}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer relative ${
            activeTab === "queue" ? "text-purple-400 font-bold" : "hover:text-slate-200"
          }`}
        >
          <ListMusic className="w-4 h-4" />
          <span className="text-[10px]">Hàng đợi</span>
        </button>

        <button
          onClick={() => setActiveTab("soundboard")}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors cursor-pointer ${
            activeTab === "soundboard" ? "text-rose-400 font-bold" : "hover:text-slate-200"
          }`}
        >
          <PartyPopper className="w-4 h-4" />
          <span className="text-[10px]">Tương tác</span>
        </button>

        {/* 5. Nút Phát Trên TV trong Bottom Navigation Bar */}
        <CastButton
          variant="nav"
          status="disconnected"
          onClick={() => setShowCastModal(true)}
        />
      </footer>

      {/* Cast to TV Modal */}
      <CastDeviceModal
        isOpen={showCastModal}
        onClose={() => setShowCastModal(false)}
        status="disconnected"
        onConnectRoom={handleConnectRoom}
        onDisconnectRoom={() => {}}
      />
    </div>
  );
}
