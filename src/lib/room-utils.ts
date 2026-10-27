/**
 * Generate a random 6-character room ID (e.g., 'KARA88', 'SING59', 'BEAT92').
 * Matches the requested format: 4 uppercase letters + 2 digits = 6 characters.
 */
export function generateRoomId(length: number = 6): string {
  if (length === 6) {
    const prefixes = ["KARA", "SING", "BEAT", "LIVE", "STAR", "VOICE"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const digits = Math.floor(10 + Math.random() * 90); // 2 digits: 10 - 99
    return `${prefix}${digits}`;
  }

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    result += chars.charAt(randomIndex);
  }
  return result;
}

/**
 * Format room ID for clean display
 */
export function formatRoomId(roomId: string): string {
  return roomId ? roomId.trim().toUpperCase() : "";
}
