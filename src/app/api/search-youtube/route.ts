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
 * Fallback popular Vietnamese Karaoke songs in case of external network block
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

    // Requirement: Tự động nối thêm hậu tố 'karaoke beat' vào sau từ khóa (hỗ trợ mở rộng từ viết tắt)
    const cleanedQuery = rawQuery.trim();
    const expandedQuery = expandAcronymQuery(cleanedQuery);
    const finalSearchQuery = `${expandedQuery} karaoke beat`;

    console.log(
      `[YouTube Search] Query: "${rawQuery}" (Expanded: "${expandedQuery}") -> Searching: "${finalSearchQuery}"`
    );

    // Fetch YouTube public search page
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
      finalSearchQuery
    )}`;

    const response = await fetch(ytUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      next: { revalidate: 3600 }, // Cache search for 1 hour
    });

    if (!response.ok) {
      console.warn(`[YouTube Search] Fetch failed with status: ${response.status}`);
      return NextResponse.json({
        success: true,
        query: finalSearchQuery,
        results: FALLBACK_KARAOKE_SONGS.filter((s) =>
          s.title.toLowerCase().includes(cleanedQuery.toLowerCase())
        ),
      });
    }

    const html = await response.text();

    // Extract ytInitialData embedded in the page
    const match =
      html.match(/var ytInitialData = ({[\s\S]*?});<\/script>/) ||
      html.match(/ytInitialData\s*=\s*({[\s\S]+?});/);

    if (!match || !match[1]) {
      console.warn("[YouTube Search] ytInitialData not found in HTML response");
      return NextResponse.json({
        success: true,
        query: finalSearchQuery,
        results: FALLBACK_KARAOKE_SONGS,
      });
    }

    const json = JSON.parse(match[1]);
    const sections =
      json.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer
        ?.contents || [];

    const results: YouTubeSearchResult[] = [];

    for (const section of sections) {
      const items = section.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const vr = item.videoRenderer;
        if (vr && vr.videoId) {
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

    console.log(`[YouTube Search] Found ${results.length} results for "${finalSearchQuery}"`);

    return NextResponse.json({
      success: true,
      query: finalSearchQuery,
      results: results.length > 0 ? results : FALLBACK_KARAOKE_SONGS,
    });
  } catch (error) {
    console.error("[YouTube Search] Error processing search request:", error);
    return NextResponse.json(
      {
        success: true,
        query: "",
        results: FALLBACK_KARAOKE_SONGS,
      },
      { status: 200 }
    );
  }
}
