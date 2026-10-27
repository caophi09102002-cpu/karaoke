import { NextResponse } from "next/server";
import { expandAcronymQuery } from "@/lib/vietnamese-search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get("q");

    if (!rawQuery || rawQuery.trim().length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const cleanedQuery = rawQuery.trim();
    // Support expanding Vietnamese acronyms (e.g. "cdns" -> "Cắt Đôi Nỗi Sầu")
    const expandedQuery = expandAcronymQuery(cleanedQuery);

    const suggestUrl = `https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(
      expandedQuery
    )}`;

    const response = await fetch(suggestUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
      },
      next: { revalidate: 1800 }, // Cache suggestion for 30 minutes
    });

    if (!response.ok) {
      return NextResponse.json({ suggestions: [] });
    }

    const data = await response.json();
    // Data format: [query, [suggestion_1, suggestion_2, ...]]
    const rawSuggestions: string[] = Array.isArray(data?.[1]) ? data[1] : [];

    const musicKeywords = ["karaoke", "beat", "tone nam", "tone nữ", "remix", "lyrics", "cover", "nhạc"];

    // Split into music-specific vs general suggestions
    const musicSuggestions: string[] = [];
    const generalSuggestions: string[] = [];

    for (const item of rawSuggestions) {
      const lower = item.toLowerCase();
      const hasMusicWord = musicKeywords.some((kw) => lower.includes(kw));
      if (hasMusicWord) {
        musicSuggestions.push(item);
      } else {
        generalSuggestions.push(item);
      }
    }

    // Prioritize music/karaoke suggestions
    const combined = [...musicSuggestions, ...generalSuggestions];

    // If music suggestions are few, add helpful karaoke variations for the top general result
    if (musicSuggestions.length < 3 && generalSuggestions.length > 0) {
      const topSong = generalSuggestions[0];
      const extra1 = `${topSong} karaoke`;
      const extra2 = `${topSong} karaoke tone nam`;
      const extra3 = `${topSong} karaoke tone nữ`;

      if (!combined.some((s) => s.toLowerCase() === extra1.toLowerCase())) {
        combined.splice(1, 0, extra1);
      }
      if (!combined.some((s) => s.toLowerCase() === extra2.toLowerCase())) {
        combined.splice(2, 0, extra2);
      }
      if (!combined.some((s) => s.toLowerCase() === extra3.toLowerCase())) {
        combined.splice(3, 0, extra3);
      }
    }

    // Deduplicate and cap to 10 suggestions
    const uniqueSuggestions: string[] = [];
    const seen = new Set<string>();

    for (const s of combined) {
      const key = s.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        uniqueSuggestions.push(s.trim());
      }
      if (uniqueSuggestions.length >= 10) break;
    }

    return NextResponse.json({ suggestions: uniqueSuggestions });
  } catch (error) {
    console.error("[Suggestions API Error]:", error);
    return NextResponse.json({ suggestions: [] });
  }
}
