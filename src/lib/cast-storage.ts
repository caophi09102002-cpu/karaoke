export interface RecentDevice {
  roomId: string;
  name: string;
  lastConnectedAt: number;
}

const STORAGE_KEY = "karaoke_recent_devices";
const LAST_ROOM_KEY = "karaoke_last_room_id";

export function getRecentDevices(): RecentDevice[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.sort((a, b) => (b.lastConnectedAt || 0) - (a.lastConnectedAt || 0));
    }
    return [];
  } catch (e) {
    console.error("Error reading recent devices from localStorage", e);
    return [];
  }
}

export function saveRecentDevice(roomId: string, customName?: string): RecentDevice[] {
  if (typeof window === "undefined" || !roomId) return [];
  try {
    const normalizedId = roomId.trim().toUpperCase();
    const currentList = getRecentDevices();
    const existing = currentList.find((d) => d.roomId === normalizedId);

    const name = customName?.trim() || existing?.name || `TV Phòng ${normalizedId}`;
    const updated = [
      { roomId: normalizedId, name, lastConnectedAt: Date.now() },
      ...currentList.filter((d) => d.roomId !== normalizedId),
    ].slice(0, 10); // Keep top 10

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(LAST_ROOM_KEY, normalizedId);
    return updated;
  } catch (e) {
    console.error("Error saving recent device to localStorage", e);
    return [];
  }
}

export function updateRecentDeviceName(roomId: string, newName: string): RecentDevice[] {
  if (typeof window === "undefined" || !roomId) return [];
  try {
    const normalizedId = roomId.trim().toUpperCase();
    const currentList = getRecentDevices();
    const updated = currentList.map((d) =>
      d.roomId === normalizedId ? { ...d, name: newName.trim() || `TV Phòng ${normalizedId}` } : d
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error("Error updating device name in localStorage", e);
    return [];
  }
}

export function removeRecentDevice(roomId: string): RecentDevice[] {
  if (typeof window === "undefined" || !roomId) return [];
  try {
    const normalizedId = roomId.trim().toUpperCase();
    const currentList = getRecentDevices();
    const updated = currentList.filter((d) => d.roomId !== normalizedId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Also remove from last room if it matches
    const lastRoom = localStorage.getItem(LAST_ROOM_KEY);
    if (lastRoom === normalizedId) {
      localStorage.removeItem(LAST_ROOM_KEY);
    }
    return updated;
  } catch (e) {
    console.error("Error removing recent device from localStorage", e);
    return [];
  }
}

export function clearRecentDevices(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_ROOM_KEY);
  } catch (e) {
    console.error("Error clearing recent devices from localStorage", e);
  }
}

export function getDeviceName(roomId: string): string {
  if (!roomId) return "Chưa kết nối TV";
  const devices = getRecentDevices();
  const found = devices.find((d) => d.roomId === roomId.toUpperCase());
  return found?.name || `TV Phòng ${roomId.toUpperCase()}`;
}
