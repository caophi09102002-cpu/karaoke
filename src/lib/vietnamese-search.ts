/**
 * Vietnamese text normalization and acronym matching utility.
 * Example: 'Cắt Đôi Nỗi Sầu' -> 'cdns'
 */

/**
 * Remove Vietnamese accents and convert to lowercase.
 */
export function removeVietnameseTones(str: string): string {
  if (!str) return "";
  let clean = str.trim().toLowerCase();

  // Normalize Unicode
  clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Specific Vietnamese characters replacement
  clean = clean
    .replace(/[đĐ]/g, "d")
    .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, "a")
    .replace(/[èéẹẻẽêềếệểễ]/g, "e")
    .replace(/[ìíịỉĩ]/g, "i")
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
    .replace(/[ùúụủũưừứựửữ]/g, "u")
    .replace(/[ỳýỵỷỹ]/g, "y");

  return clean;
}

/**
 * Extract acronym from text.
 * Example: 'Cắt Đôi Nỗi Sầu' -> 'cdns'
 * Example: 'Tăng Duy Tân - Cắt Đôi Nỗi Sầu (Tone Nam)' -> 'tdtcdns'
 */
export function extractAcronym(str: string): string {
  if (!str) return "";
  const normalized = removeVietnameseTones(str);

  // Replace non-alphanumeric with spaces, then split
  const words = normalized
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);

  return words.map((w) => w[0]).join("");
}

/**
 * Check if a text matches a query:
 * 1. Direct substring match (fuzzy/accent-insensitive): 'cat doi noi sau' in 'Cắt Đôi Nỗi Sầu'
 * 2. Acronym match: 'cdns' in acronym of 'Cắt Đôi Nỗi Sầu'
 */
export function matchesSmartSearch(text: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  if (!text) return false;

  const q = removeVietnameseTones(query).replace(/\s+/g, "");
  const textNorm = removeVietnameseTones(text);

  // 1. Direct text match (ignoring spaces & accents)
  const textNoSpaces = textNorm.replace(/\s+/g, "");
  if (textNoSpaces.includes(q)) return true;

  // 2. Acronym match
  const acronym = extractAcronym(text);
  if (acronym.includes(q)) return true;

  // 3. Sub-acronym match (e.g., matching within each part separated by dash or parentheses)
  const segments = text.split(/[-–—()|]/);
  for (const seg of segments) {
    if (extractAcronym(seg).includes(q)) {
      return true;
    }
  }

  return false;
}

/**
 * Common Vietnamese Karaoke acronym expansion dictionary.
 * Helps map acronyms to full song names for YouTube search.
 */
export const POPULAR_ACRONYM_MAP: Record<string, string> = {
  cdns: "Cắt Đôi Nỗi Sầu",
  nhnt: "Nơi Này Có Anh",
  bttl: "Bên Trên Tầng Lầu",
  btt: "Bên Trên Tầng Lầu",
  ndt: "Ngày Đầu tiên",
  ndti: "Ngày Đầu Tiên",
  lt: "Lạc Trôi",
  mbyvd: "Một Bước Yêu Vạn Dặm Đau",
  mbyvdd: "Một Bước Yêu Vạn Dặm Đau",
  sg: "Sóng Gió",
  bc: "Bạc Phận",
  hm: "Hồng Nhan",
  eclmd: "Em Của Ngày Hôm Qua",
  ecnhq: "Em Của Ngày Hôm Qua",
  ckn: "Có Không Giữ Mất Đừng Tìm",
  ckgmdt: "Có Không Giữ Mất Đừng Tìm",
  dttd: "Đúng Cũng Thành Sai",
  chdt: "Chạy Về Nơi Phía Anh",
  cvnpa: "Chạy Về Nơi Phía Anh",
  dvd: "Đi Về Nhà",
  dvn: "Đi Về Nhà",
  tt: "Tình Thôi Xót Xa",
  ttxx: "Tình Thôi Xót Xa",
  hhd: "Hoa Hải Đường",
};

/**
 * Expand query if it matches a known popular acronym
 */
export function expandAcronymQuery(query: string): string {
  const cleanQ = removeVietnameseTones(query).trim().toLowerCase();
  return POPULAR_ACRONYM_MAP[cleanQ] || query;
}
