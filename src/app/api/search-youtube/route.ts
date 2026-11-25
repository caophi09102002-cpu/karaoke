import { NextResponse } from "next/server";
import { expandAcronymQuery } from "@/lib/vietnamese-search";

export interface YouTubeSearchResult {
  youtubeId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
  duration?: string;
  durationSec?: number;
}

/**
 * Fallback popular Vietnamese Karaoke songs only in case of complete network outage
 */
const FALLBACK_KARAOKE_SONGS: YouTubeSearchResult[] = [
  {
    youtubeId: "iIsfYYw4b2A",
    title: "CẮT ĐÔI NỖI SẦU (ft DRUM7) | OFFICIAL KARAOKE BẢN CHUẨN",
    thumbnail: "https://i.ytimg.com/vi/iIsfYYw4b2A/hqdefault.jpg",
    channelTitle: "Big Arts Entertainment",
    duration: "4:12",
    durationSec: 252,
  },
  {
    youtubeId: "fn3KWM1kuAw",
    title: "NƠI NÀY CÓ ANH - SƠN TÙNG M-TP | OFFICIAL KARAOKE BEAT",
    thumbnail: "https://i.ytimg.com/vi/fn3KWM1kuAw/hqdefault.jpg",
    channelTitle: "Sơn Tùng M-TP Official",
    duration: "4:20",
    durationSec: 260,
  },
  {
    youtubeId: "wsf68vj1UoE",
    title: "NGÀY ĐẦU TIÊN - ĐỨC PHÚC | OFFICIAL KARAOKE BEAT",
    thumbnail: "https://i.ytimg.com/vi/wsf68vj1UoE/hqdefault.jpg",
    channelTitle: "Đức Phúc Official",
    duration: "3:40",
    durationSec: 220,
  },
  {
    youtubeId: "3mKqKx8x7w8",
    title: "BÊN TRÊN TẦNG LẦU - TĂNG DUY TÂN | KARAOKE BEAT CHUẨN",
    thumbnail: "https://i.ytimg.com/vi/3mKqKx8x7w8/hqdefault.jpg",
    channelTitle: "Big Arts Entertainment",
    duration: "3:30",
    durationSec: 210,
  },
  {
    youtubeId: "Xyjh9x5vM2c",
    title: "MỘT BƯỚC YÊU VẠN DẶM ĐAU - MR.SIRO | KARAOKE BEAT",
    thumbnail: "https://i.ytimg.com/vi/Xyjh9x5vM2c/hqdefault.jpg",
    channelTitle: "Mr. Siro Official",
    duration: "5:05",
    durationSec: 305,
  },
];

function parseDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 240;
  const parts = durationStr.split(":").map((p) => parseInt(p, 10));
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  return 240;
}

/**
 * Perform YouTube public scrape search for a specific query string
 */
async function fetchYouTubeSearch(searchQuery: string): Promise<YouTubeSearchResult[]> {
  try {
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const response = await fetch(ytUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      next: { revalidate: 1800 }, // Cache search results for 30 minutes
    });

    if (!response.ok) {
      console.warn(`[YouTube Search] Fetch failed with status: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const match =
      html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/) ||
      html.match(/ytInitialData\s*=\s*({[\s\S]+?});/);

    if (!match || !match[1]) {
      console.warn("[YouTube Search] ytInitialData not found in HTML response");
      return [];
    }

    const json = JSON.parse(match[1]);
    const sections =
      json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents || [];

    const results: YouTubeSearchResult[] = [];
    const seenIds = new Set<string>();

    for (const section of sections) {
      const items = section.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item.videoRenderer;
        if (vr && vr.videoId && !seenIds.has(vr.videoId)) {
          seenIds.add(vr.videoId);

          // Clean title
          const title =
            vr.title?.runs?.[0]?.text ||
            vr.title?.accessibility?.accessibilityData?.label ||
            "Karaoke Track";

          // High-res or medium thumbnail
          const thumbs = vr.thumbnail?.thumbnails || [];
          const thumbnail =
            thumbs[thumbs.length - 1]?.url ||
            thumbs[0]?.url ||
            `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;

          // Channel Name
          const channelTitle =
            vr.ownerText?.runs?.[0]?.text ||
            vr.longBylineText?.runs?.[0]?.text ||
            "Karaoke";

          // Duration
          const duration = vr.lengthText?.simpleText || "4:00";
          const durationSec = parseDurationToSeconds(duration);

          results.push({
            youtubeId: vr.videoId,
            title,
            thumbnail,
            channelTitle,
            duration,
            durationSec,
          });

          // Limit to top 20 best results
          if (results.length >= 20) break;
        }
      }
      if (results.length >= 20) break;
    }

    return results;
  } catch (err) {
    console.error("[YouTube Search Scraping Error]:", err);
    return [];
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q");

    if (!rawQuery || rawQuery.trim().length === 0) {
      return NextResponse.json({
        success: true,
        query: "",
        results: [],
      });
    }

    const cleanedQuery = rawQuery.trim();
    const expandedQuery = expandAcronymQuery(cleanedQuery);
    const lower = expandedQuery.toLowerCase();

    // Check if query already contains music / karaoke terms
    const hasSpecificKeyword =
      lower.includes("karaoke") ||
      lower.includes("beat") ||
      lower.includes("instrumental") ||
      lower.includes("tone nam") ||
      lower.includes("tone nữ") ||
      lower.includes("remix") ||
      lower.includes("acapella");

    let results: YouTubeSearchResult[] = [];
    let usedQuery = expandedQuery;

    if (hasSpecificKeyword) {
      // Strategy 1: User explicitly searched a keyword or clicked an autocomplete suggestion like "Khóa Ly Biệt karaoke tone nam"
      // -> Search directly without double-appending keywords!
      usedQuery = expandedQuery;
      console.log(`[YouTube Search] Strategy 1 (Direct): "${usedQuery}"`);
      results = await fetchYouTubeSearch(usedQuery);

      if (results.length === 0 && expandedQuery !== cleanedQuery) {
        console.log(`[YouTube Search] Strategy 1b (Cleaned): "${cleanedQuery}"`);
        results = await fetchYouTubeSearch(cleanedQuery);
      }
    } else {
      // Strategy 2: User searched a song name like "Trống Cơm Anh Trai Vượt Ngàn Chông Gai" or "Đom Đóm"
      // -> First try searching with "karaoke" (NOT "karaoke beat" to avoid zero-results for new songs)
      const karaokeQuery = `${expandedQuery} karaoke`;
      usedQuery = karaokeQuery;
      console.log(`[YouTube Search] Strategy 2 (with karaoke): "${karaokeQuery}"`);
      results = await fetchYouTubeSearch(karaokeQuery);

      // Strategy 3: If 0 karaoke videos found (e.g. brand new songs, official songs without "karaoke" in title),
      // fallback to searching the exact song name directly!
      if (results.length === 0) {
        console.log(`[YouTube Search] Strategy 3 (Fallback Raw): "${expandedQuery}"`);
        usedQuery = expandedQuery;
        results = await fetchYouTubeSearch(expandedQuery);
      }
    }

    console.log(`[YouTube Search] Final Results Count: ${results.length} for "${usedQuery}"`);

    // Return exact results (or empty array if no matches found on YouTube)
    // NEVER dump unrelated fallback songs over a real search query!
    return NextResponse.json({
      success: true,
      query: usedQuery,
      results,
    });
  } catch (error) {
    console.error("[YouTube Search Route Error]:", error);
    return NextResponse.json(
      {
        success: false,
        query: "",
        results: [],
        message: "Lỗi kết nối tìm kiếm, vui lòng thử lại!",
      },
      { status: 500 }
    );
  }
}
