"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Cast,
  Tv,
  QrCode,
  KeyRound,
  History,
  X,
  Check,
  Copy,
  Wifi,
  Users,
  Crown,
  User,
  PowerOff,
  Camera,
  RefreshCw,
  Edit2,
  Trash2,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  MonitorPlay,
  Sparkles,
} from "lucide-react";
import {
  getRecentDevices,
  saveRecentDevice,
  removeRecentDevice,
  updateRecentDeviceName,
  RecentDevice,
} from "@/lib/cast-storage";
import { CastStatus } from "./CastButton";

interface CastDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: CastStatus;
  currentRoomId?: string;
  currentTvName?: string;
  pingMs?: number | null;
  controllersCount?: number;
  role?: "guest" | "admin";
  onConnectRoom: (roomId: string) => void;
  onDisconnectRoom: () => void;
  onUpdateTvName?: (newName: string) => void;
}

export default function CastDeviceModal({
  isOpen,
  onClose,
  status,
  currentRoomId = "",
  currentTvName,
  pingMs,
  controllersCount = 1,
  role = "guest",
  onConnectRoom,
  onDisconnectRoom,
  onUpdateTvName,
}: CastDeviceModalProps) {
  // Navigation inside modal: 'pin' | 'qr' | 'history' | 'status'
  const [activeTab, setActiveTab] = useState<"pin" | "qr" | "history">("pin");
  const [isChangingTv, setIsChangingTv] = useState<boolean>(false);

  // 6-digit PIN input state
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // QR Code Scanner State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<any>(null);

  // Recent Devices State
  const [recentDevices, setRecentDevices] = useState<RecentDevice[]>([]);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editingDeviceName, setEditingDeviceName] = useState<string>("");

  // TV Name Editing State for Connected TV
  const [isEditingCurrentName, setIsEditingCurrentName] = useState(false);
  const [tvNameInput, setTvNameInput] = useState("");

  // Copy feedback
  const [copiedCode, setCopiedCode] = useState(false);

  // Presentation API support detection
  const [hasPresentationApi, setHasPresentationApi] = useState(false);

  // Load recent devices when modal opens
  useEffect(() => {
    if (isOpen) {
      const devices = getRecentDevices();
      setRecentDevices(devices);
      setIsChangingTv(false);
      setCameraError(null);
      setPinDigits(["", "", "", "", "", ""]);

      // Presentation API check
      if (typeof window !== "undefined" && "PresentationRequest" in window) {
        setHasPresentationApi(true);
      }

      // Default to history if available and not connected, otherwise pin
      if (status === "disconnected") {
        if (devices.length > 0) {
          setActiveTab("history");
        } else {
          setActiveTab("pin");
        }
      }
    } else {
      // Stop scanner when modal closes
      stopQrScanner();
    }
  }, [isOpen, status]);

  // Sync editing name
  useEffect(() => {
    if (currentTvName) {
      setTvNameInput(currentTvName);
    } else if (currentRoomId) {
      setTvNameInput(`TV Phòng ${currentRoomId}`);
    }
  }, [currentTvName, currentRoomId]);

  // Clean up QR Scanner on unmount
  useEffect(() => {
    return () => {
      stopQrScanner();
    };
  }, []);

  // Format relative time helper
  const formatRelativeTime = (timestamp: number) => {
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return "Vừa xong";
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return `${Math.floor(diff / 86400)} ngày trước`;
  };

  // =========================================================================
  // PIN 6 Ô VUÔNG: LOGIC NHẬP TỰ ĐỘNG FOCUS & PASTE
  // =========================================================================
  const handlePinChange = (index: number, value: string) => {
    // Only allow alphanumeric uppercase
    const cleanChar = value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

    if (!cleanChar) {
      // Empty
      const newDigits = [...pinDigits];
      newDigits[index] = "";
      setPinDigits(newDigits);
      return;
    }

    // Single character input
    const char = cleanChar.slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = char;
    setPinDigits(newDigits);

    // Auto-focus next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!pinDigits[index] && index > 0) {
        // Jump back to previous input on backspace if current is empty
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "Enter") {
      const fullCode = pinDigits.join("").trim();
      if (fullCode.length === 6) {
        handleConnectWithCode(fullCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim().toUpperCase();
    // Extract first 6 alphanumeric chars
    const cleanChars = pastedData.replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (!cleanChars) return;

    const newDigits = [...pinDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = cleanChars[i] || "";
    }
    setPinDigits(newDigits);

    // Focus last filled or next empty
    const nextIndex = Math.min(cleanChars.length, 5);
    inputRefs.current[nextIndex]?.focus();

    if (cleanChars.length === 6) {
      handleConnectWithCode(cleanChars);
    }
  };

  const handleConnectWithCode = (code?: string) => {
    const finalCode = (code || pinDigits.join("")).trim().toUpperCase();
    if (finalCode.length < 3) return;

    saveRecentDevice(finalCode);
    onConnectRoom(finalCode);
    onClose();
  };

  // =========================================================================
  // QR CODE SCANNER LOGIC (html5-qrcode)
  // =========================================================================
  const startQrScanner = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      // Give DOM time to mount container
      await new Promise((res) => setTimeout(res, 150));

      const scannerElement = document.getElementById("qr-reader-target");
      if (!scannerElement) {
        setCameraError("Không tìm thấy khung hình máy ảnh.");
        setIsScanning(false);
        return;
      }

      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
          html5QrCodeRef.current.clear();
        } catch (_) {}
      }

      const html5QrCode = new Html5Qrcode("qr-reader-target");
      html5QrCodeRef.current = html5QrCode;

      const qrCodeSuccessCallback = (decodedText: string) => {
        // Extract room code: might be URL like http://.../room/XYZ123/controller or direct code XYZ123
        let extractedRoom = decodedText.trim();

        // Check if URL
        const roomMatch = decodedText.match(/\/room\/([A-Za-z0-9_-]+)/i);
        if (roomMatch && roomMatch[1]) {
          extractedRoom = roomMatch[1];
        }

        extractedRoom = extractedRoom.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

        if (extractedRoom.length >= 3) {
          // Play success vibration if supported
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate([80, 50, 80]);
          }

          stopQrScanner();
          saveRecentDevice(extractedRoom);
          onConnectRoom(extractedRoom);
          onClose();
        }
      };

      const config = {
        fps: 15,
        qrbox: { width: 230, height: 230 },
        aspectRatio: 1.0,
      };

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        undefined
      );
    } catch (err: any) {
      console.error("[CastModal] QR Scanner start error:", err);
      setCameraError(
        err?.message ||
          "Không thể truy cập máy ảnh. Vui lòng cấp quyền truy cập Camera trên trình duyệt của bạn!"
      );
      setIsScanning(false);
    }
  };

  const stopQrScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn("[CastModal] QR Scanner stop warning:", err);
      } finally {
        html5QrCodeRef.current = null;
        setIsScanning(false);
      }
    } else {
      setIsScanning(false);
    }
  };

  // Switch tabs cleanly
  const handleTabSwitch = (tab: "pin" | "qr" | "history") => {
    if (activeTab === "qr" && tab !== "qr") {
      stopQrScanner();
    }
    setActiveTab(tab);
    if (tab === "qr") {
      startQrScanner();
    }
  };

  // =========================================================================
  // PRESENTATION API / GOOGLE CAST TRIGGER
  // =========================================================================
  const handlePresentationCast = async () => {
    try {
      if (typeof window !== "undefined" && "PresentationRequest" in window) {
        const presentationUrl = `${window.location.origin}/room/${currentRoomId || "CAST"}/host`;
        const request = new (window as any).PresentationRequest([presentationUrl]);
        await request.start();
      } else {
        alert("Trình duyệt này chưa hỗ trợ Presentation API hoặc không tìm thấy thiết bị Cast trong mạng.");
      }
    } catch (err: any) {
      console.info("[CastModal] Presentation request cancelled or error:", err);
    }
  };

  // Copy room code
  const handleCopyCode = () => {
    if (!currentRoomId) return;
    navigator.clipboard.writeText(currentRoomId);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Save renamed TV in connected state
  const handleSaveCurrentTvName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentRoomId || !tvNameInput.trim()) return;
    updateRecentDeviceName(currentRoomId, tvNameInput.trim());
    if (onUpdateTvName) {
      onUpdateTvName(tvNameInput.trim());
    }
    setRecentDevices(getRecentDevices());
    setIsEditingCurrentName(false);
  };

  // Save renamed device in history
  const handleSaveRecentDeviceName = (roomId: string) => {
    if (!editingDeviceName.trim()) return;
    const updated = updateRecentDeviceName(roomId, editingDeviceName.trim());
    setRecentDevices(updated);
    setEditingDeviceId(null);
  };

  // Delete recent device
  const handleDeleteRecentDevice = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    const updated = removeRecentDevice(roomId);
    setRecentDevices(updated);
  };

  if (!isOpen) return null;

  const isConnected = status === "connected" && !isChangingTv;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md transition-all animate-in fade-in duration-200">
      {/* Click outside to close */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Bottom Sheet / Modal Card */}
      <div
        className="relative w-full max-w-md bg-zinc-950 border-t sm:border border-white/[0.1] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Swipe / Pull Handle */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-zinc-800 rounded-full" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl flex items-center justify-center ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-white/[0.06] text-zinc-300 border border-white/[0.08]"
              }`}
            >
              <Cast className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Phát trên TV
                {isConnected && (
                  <span className="text-[10px] font-medium uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    Đã kết nối
                  </span>
                )}
              </h3>
              <p className="text-xs text-zinc-400">
                {isConnected
                  ? "Đang đồng bộ màn hình với TV"
                  : "Kết nối điện thoại với màn hình Karaoke"}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* =========================================================================
              STATE A: ĐÃ KẾT NỐI PHÒNG THÀNH CÔNG (Connected Device Information)
             ========================================================================= */}
          {isConnected ? (
            <div className="space-y-4">
              {/* Connected TV Card */}
              <div className="p-4 bg-zinc-900/60 border border-white/[0.1] rounded-2xl shadow-sm relative overflow-hidden">
                {/* TV Name & Edit */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                      Thiết bị hiển thị chính
                    </span>
                    {isEditingCurrentName ? (
                      <form onSubmit={handleSaveCurrentTvName} className="flex items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={tvNameInput}
                          onChange={(e) => setTvNameInput(e.target.value)}
                          maxLength={30}
                          autoFocus
                          className="flex-1 bg-zinc-950 border border-white/[0.12] rounded-lg px-2.5 py-1 text-sm text-white focus:outline-none focus:border-white/40"
                        />
                        <button
                          type="submit"
                          className="px-2.5 py-1 bg-white hover:bg-zinc-200 text-zinc-950 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingCurrentName(false)}
                          className="px-2 py-1 bg-zinc-800 text-zinc-400 hover:text-white text-xs rounded-lg"
                        >
                          Hủy
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <h4 className="text-base font-semibold text-white truncate">
                          {currentTvName || `TV Phòng ${currentRoomId}`}
                        </h4>
                        <button
                          onClick={() => setIsEditingCurrentName(true)}
                          className="p-1 text-zinc-400 hover:text-white transition-colors"
                          title="Đổi tên TV dễ nhớ"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                    <Tv className="w-5 h-5" />
                  </div>
                </div>

                {/* Room Info Grid */}
                <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-white/[0.06] text-xs">
                  {/* Mã phòng */}
                  <div className="p-2.5 bg-zinc-950 rounded-xl border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-zinc-400">Mã phòng TV:</div>
                      <div className="font-mono font-bold text-sm text-white tracking-wider">
                        {currentRoomId}
                      </div>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors cursor-pointer"
                      title="Sao chép mã phòng"
                    >
                      {copiedCode ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Độ trễ Ping */}
                  <div className="p-2.5 bg-zinc-950 rounded-xl border border-white/[0.06] flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-zinc-400">Độ trễ (Ping):</div>
                      <div className="font-mono font-medium text-sm text-emerald-400 flex items-center gap-1">
                        <Wifi className="w-3.5 h-3.5" />
                        <span>{pingMs ? `${pingMs}ms` : "~15ms"}</span>
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>

                  {/* Người cùng phòng */}
                  <div className="p-2.5 bg-zinc-950 rounded-xl border border-white/[0.06] flex items-center gap-2">
                    <div className="p-1.5 bg-white/[0.06] text-zinc-300 rounded-lg">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400">Đang tham gia:</div>
                      <div className="font-medium text-zinc-200">
                        {controllersCount} thiết bị
                      </div>
                    </div>
                  </div>

                  {/* Quyền điều khiển */}
                  <div className="p-2.5 bg-zinc-950 rounded-xl border border-white/[0.06] flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg ${
                        role === "admin"
                          ? "bg-amber-400/10 text-amber-300"
                          : "bg-white/[0.06] text-zinc-400"
                      }`}
                    >
                      {role === "admin" ? (
                        <Crown className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5" />
                      )}
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400">Quyền hạn:</div>
                      <div
                        className={`font-medium ${
                          role === "admin" ? "text-amber-300" : "text-zinc-300"
                        }`}
                      >
                        {role === "admin" ? "Chủ phòng" : "Khách hát"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Presentation API / Google Cast Option */}
              {hasPresentationApi && (
                <button
                  type="button"
                  onClick={handlePresentationCast}
                  className="w-full py-2.5 px-3 bg-zinc-900/60 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white rounded-xl flex items-center justify-between text-xs font-medium transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <MonitorPlay className="w-4 h-4 text-zinc-400" />
                    <span>Chiếu qua Chromecast / Trình duyệt</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500" />
                </button>
              )}

              {/* Action Buttons: Đổi TV & Ngắt kết nối */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangingTv(true)}
                  className="flex-1 py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-white/[0.08] text-zinc-200 text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-95"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-zinc-300" />
                  <span>Đổi TV Khác</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onDisconnectRoom();
                    onClose();
                  }}
                  className="flex-1 py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-xs font-medium rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-95"
                >
                  <PowerOff className="w-3.5 h-3.5" />
                  <span>Ngắt kết nối</span>
                </button>
              </div>
            </div>
          ) : (
            /* =========================================================================
                STATE B: CHƯA KẾT NỐI HOẶC ĐANG ĐỔI TV (3 Tabs: PIN, QR, Recent Devices)
               ========================================================================= */
            <div className="space-y-4">
              {/* Back to status if was connected and changing TV */}
              {isChangingTv && (
                <div className="flex items-center justify-between pb-1">
                  <button
                    type="button"
                    onClick={() => setIsChangingTv(false)}
                    className="text-xs text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    ← Quay lại TV hiện tại ({currentRoomId})
                  </button>
                </div>
              )}

              {/* Tab Selector Buttons */}
              <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-900 border border-white/[0.08] rounded-xl text-xs font-medium">
                <button
                  type="button"
                  onClick={() => handleTabSwitch("pin")}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === "pin"
                      ? "bg-white text-zinc-950 font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Nhập mã</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabSwitch("qr")}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                    activeTab === "qr"
                      ? "bg-white text-zinc-950 font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Quét QR</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTabSwitch("history")}
                  className={`py-2 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer relative ${
                    activeTab === "history"
                      ? "bg-white text-zinc-950 font-semibold shadow-sm"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>TV đã lưu</span>
                  {recentDevices.length > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 absolute top-2 right-2" />
                  )}
                </button>
              </div>

              {/* -------------------------------------------------------------
                  TAB 1: NHẬP MÃ PIN 6 SỐ / KÝ TỰ (6 Ô VUÔNG TỰ NHẢY FOCUS)
                 ------------------------------------------------------------- */}
              {activeTab === "pin" && (
                <div className="space-y-4 py-2 animate-in fade-in duration-150">
                  <div className="text-center space-y-1">
                    <p className="text-xs text-zinc-300 font-medium">
                      Nhập mã 6 ký tự hiển thị trên màn hình TV:
                    </p>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      (Ví dụ: <span className="text-zinc-300 font-semibold">KARA88</span> hoặc mã phòng)
                    </p>
                  </div>

                  {/* 6 Digit Input Boxes */}
                  <div className="flex items-center justify-center gap-2 sm:gap-2.5">
                    {pinDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          inputRefs.current[index] = el;
                        }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handlePinChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        onPaste={handlePaste}
                        autoFocus={index === 0}
                        className={`w-11 h-14 sm:w-12 sm:h-16 text-center text-xl sm:text-2xl font-bold font-mono uppercase bg-zinc-950 border rounded-2xl text-white outline-none transition-colors ${
                          digit
                            ? "border-white/40 bg-zinc-900"
                            : "border-white/[0.1] focus:border-white/40 focus:bg-zinc-900"
                        }`}
                      />
                    ))}
                  </div>

                  {/* Quick Connect Button */}
                  <button
                    type="button"
                    onClick={() => handleConnectWithCode()}
                    disabled={pinDigits.join("").trim().length < 3}
                    className="w-full py-3 px-4 bg-white hover:bg-zinc-200 disabled:opacity-40 text-zinc-950 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Tv className="w-4 h-4" />
                    <span>Kết nối đến TV này</span>
                  </button>
                </div>
              )}

              {/* -------------------------------------------------------------
                  TAB 2: QUÉT MÃ QR (html5-qrcode Trực Tiếp Trên Web)
                 ------------------------------------------------------------- */}
              {activeTab === "qr" && (
                <div className="space-y-3 py-1 animate-in fade-in duration-150">
                  <div className="text-center">
                    <p className="text-xs text-zinc-300">
                      Hướng camera về mã QR trên màn hình TV:
                    </p>
                  </div>

                  {/* Camera Viewfinder Box */}
                  <div className="relative w-full aspect-square max-w-[280px] mx-auto bg-zinc-950 rounded-3xl overflow-hidden border border-white/[0.1] shadow-2xl flex flex-col items-center justify-center">
                    {/* The target DOM container for html5-qrcode */}
                    <div id="qr-reader-target" className="w-full h-full overflow-hidden" />

                    {/* Camera Error Message */}
                    {cameraError && (
                      <div className="absolute inset-0 p-4 bg-zinc-950/95 flex flex-col items-center justify-center text-center space-y-3 z-30">
                        <AlertCircle className="w-8 h-8 text-rose-400" />
                        <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                          {cameraError}
                        </p>
                        <button
                          type="button"
                          onClick={startQrScanner}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium rounded-xl transition-colors cursor-pointer"
                        >
                          Thử lại
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Toggle / Restart Camera Button */}
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={isScanning ? stopQrScanner : startQrScanner}
                      className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 text-xs font-medium rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{isScanning ? "Tạm dừng Camera" : "Bật lại Camera"}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* -------------------------------------------------------------
                  TAB 3: LỊCH SỬ TV GẦN ĐÂY (Recent Devices in localStorage)
                 ------------------------------------------------------------- */}
              {activeTab === "history" && (
                <div className="space-y-3 py-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
                    <span>Các TV bạn đã từng kết nối:</span>
                    <span>{recentDevices.length} thiết bị</span>
                  </div>

                  {recentDevices.length === 0 ? (
                    <div className="p-8 text-center bg-zinc-900/40 rounded-2xl border border-white/[0.06] space-y-2">
                      <Tv className="w-8 h-8 text-zinc-600 mx-auto" />
                      <p className="text-xs text-zinc-400">
                        Chưa có lịch sử kết nối TV nào trên thiết bị này.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleTabSwitch("pin")}
                        className="text-xs text-zinc-200 font-medium hover:underline"
                      >
                        Nhập mã TV để kết nối ngay →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                      {recentDevices.map((device) => {
                        const isCurrentActive =
                          status === "connected" &&
                          currentRoomId.toUpperCase() === device.roomId.toUpperCase();

                        return (
                          <div
                            key={device.roomId}
                            onClick={() => {
                              if (!isCurrentActive) {
                                saveRecentDevice(device.roomId, device.name);
                                onConnectRoom(device.roomId);
                                onClose();
                              }
                            }}
                            className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isCurrentActive
                                ? "bg-emerald-950/20 border-emerald-500/30"
                                : "bg-zinc-900/50 hover:bg-zinc-900 border-white/[0.06] hover:border-white/[0.12]"
                            }`}
                          >
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                              <div
                                className={`p-2.5 rounded-xl shrink-0 ${
                                  isCurrentActive
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-white/[0.06] text-zinc-300"
                                }`}
                              >
                                <Tv className="w-4 h-4" />
                              </div>

                              <div className="overflow-hidden flex-1">
                                {editingDeviceId === device.roomId ? (
                                  <div
                                    className="flex items-center gap-1.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="text"
                                      value={editingDeviceName}
                                      onChange={(e) => setEditingDeviceName(e.target.value)}
                                      maxLength={25}
                                      autoFocus
                                      className="bg-zinc-950 border border-white/[0.15] text-xs px-2 py-1 rounded-lg text-white outline-none w-36"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSaveRecentDeviceName(device.roomId)}
                                      className="p-1 bg-white text-zinc-950 rounded-lg text-[10px]"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-xs text-white truncate">
                                      {device.name}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingDeviceId(device.roomId);
                                        setEditingDeviceName(device.name);
                                      }}
                                      className="text-zinc-500 hover:text-zinc-300 p-0.5"
                                      title="Đổi tên TV"
                                    >
                                      <Edit2 className="w-2.5 h-2.5" />
                                    </button>
                                  </div>
                                )}

                                <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5 font-mono">
                                  <span className="text-zinc-300 font-medium">
                                    Mã: {device.roomId}
                                  </span>
                                  <span>•</span>
                                  <span>{formatRelativeTime(device.lastConnectedAt)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0">
                              {isCurrentActive ? (
                                <span className="text-[10px] text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                  Đang phát
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteRecentDevice(e, device.roomId)}
                                  className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors"
                                  title="Xóa khỏi lịch sử"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
