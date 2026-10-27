export interface FavoriteSong {
  youtubeId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration?: string;
  durationSec?: number;
  addedAt: number;
}

const STORAGE_KEY = "karaoke_favorites";

/**
 * Retrieve favorite songs from localStorage safely (client-side only)
 */
export function getFavorites(): FavoriteSong[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("[Favorites] Error loading favorites from localStorage:", e);
    return [];
  }
}

/**
 * Check if a song is currently in favorites
 */
export function isFavorite(youtubeId: string, currentList?: FavoriteSong[]): boolean {
  if (!youtubeId) return false;
  const list = currentList || getFavorites();
  return list.some((item) => item.youtubeId === youtubeId);
}

/**
 * Toggle favorite status of a song
 */
export function toggleFavorite(song: Omit<FavoriteSong, "addedAt">): {
  isFav: boolean;
  favorites: FavoriteSong[];
} {
  if (typeof window === "undefined") return { isFav: false, favorites: [] };

  const current = getFavorites();
  const existsIndex = current.findIndex((item) => item.youtubeId === song.youtubeId);

  let updated: FavoriteSong[];
  let isFav = false;

  if (existsIndex >= 0) {
    // Remove from favorites
    updated = current.filter((item) => item.youtubeId !== song.youtubeId);
    isFav = false;
  } else {
    // Add to favorites
    const newFav: FavoriteSong = {
      ...song,
      addedAt: Date.now(),
    };
    updated = [newFav, ...current];
    isFav = true;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("[Favorites] Error saving favorites to localStorage:", e);
  }

  return { isFav, favorites: updated };
}

/**
 * Remove a specific song from favorites
 */
export function removeFavorite(youtubeId: string): FavoriteSong[] {
  if (typeof window === "undefined") return [];
  const current = getFavorites();
  const updated = current.filter((item) => item.youtubeId !== youtubeId);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error("[Favorites] Error removing favorite:", e);
  }
  return updated;
}
