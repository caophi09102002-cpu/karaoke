"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  X,
  ArrowUpRight,
  Music,
  Loader2,
  Sparkles,
} from "lucide-react";

interface SearchBarWithAutocompleteProps {
  query: string;
  onChangeQuery: (query: string) => void;
  onSearch: (queryToSearch: string) => void;
  isSearching?: boolean;
  placeholder?: string;
  className?: string;
}

export default function SearchBarWithAutocomplete({
  query,
  onChangeQuery,
  onSearch,
  isSearching = false,
  placeholder = "Tìm tên bài hát hoặc viết tắt (VD: 'cdns', 'Nơi này có anh')...",
  className = "",
}: SearchBarWithAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch suggestions with debounce (280ms)
  const fetchSuggestions = useCallback((keyword: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const clean = keyword.trim();
    if (clean.length < 2) {
      setSuggestions([]);
      setIsLoadingSuggestions(false);
      return;
    }

    setIsLoadingSuggestions(true);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(clean)}`);
        if (!res.ok) throw new Error("Failed to fetch suggestions");
        const data = await res.json();
        if (Array.isArray(data?.suggestions)) {
          setSuggestions(data.suggestions);
          setIsOpen(data.suggestions.length > 0);
          setSelectedIndex(-1);
        }
      } catch (err) {
        console.error("Error fetching suggestions:", err);
        setSuggestions([]);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }, 280);
  }, []);

  // Handle Input Change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChangeQuery(val);
    fetchSuggestions(val);
  };

  // Submit search
  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    setIsOpen(false);
    inputRef.current?.blur();

    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      const chosen = suggestions[selectedIndex];
      onChangeQuery(chosen);
      onSearch(chosen);
    } else if (query.trim()) {
      onSearch(query.trim());
    }
  };

  // Select suggestion item
  const handleSelectSuggestion = (suggestionText: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    onChangeQuery(suggestionText);
    setIsOpen(false);
    inputRef.current?.blur();
    onSearch(suggestionText);
  };

  // Quick fill without searching immediately (via Arrow button)
  const handleQuickFill = (suggestionText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeQuery(suggestionText);
    inputRef.current?.focus();
    fetchSuggestions(suggestionText);
  };

  // Clear query
  const handleClear = () => {
    onChangeQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Keyboard navigation (ArrowDown, ArrowUp, Escape, Enter)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setSelectedIndex(-1);
    }
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Helper: Highlight matching query text within suggestion string
  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;

    // Simple case-insensitive matching
    const cleanHighlight = highlight.trim();
    const parts = text.split(new RegExp(`(${cleanHighlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));

    return (
      <span className="truncate">
        {parts.map((part, i) =>
          part.toLowerCase() === cleanHighlight.toLowerCase() ? (
            <span key={i} className="font-extrabold text-rose-400">
              {part}
            </span>
          ) : (
            <span key={i} className="text-slate-300 font-medium">
              {part}
            </span>
          )
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Search Input Form */}
      <form onSubmit={handleSubmit} className="relative flex items-center">
        {/* Left Search Icon / Loading Spinner */}
        <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
          {isLoadingSuggestions || isSearching ? (
            <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-slate-400 transition-colors" />
          )}
        </div>

        {/* Input Field */}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && query.trim().length >= 2) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck="false"
          className="w-full bg-slate-900 border border-slate-800 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-2xl pl-10 pr-24 py-3 text-sm text-white placeholder-slate-500 focus:outline-none shadow-lg transition-all"
        />

        {/* Right Buttons: Clear "X" and "Tìm" button */}
        <div className="absolute right-2 flex items-center gap-1.5">
          {query.trim() && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Xóa ô tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="px-3.5 py-1.5 bg-gradient-to-r from-rose-600 via-rose-500 to-purple-600 hover:from-rose-500 hover:to-purple-500 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-950/40 cursor-pointer active:scale-95"
          >
            {isSearching ? "Tìm..." : "Tìm"}
          </button>
        </div>
      </form>

      {/* =========================================================================
          DROPDOWN POPUP: GỢI Ý TỪ KHÓA (Autocomplete Suggestions)
         ========================================================================= */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-slate-900/98 backdrop-blur-2xl border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-rose-400" />
              Gợi ý bài hát & Beat
            </span>
            <span>{suggestions.length} gợi ý</span>
          </div>

          <ul className="max-h-64 overflow-y-auto divide-y divide-slate-800/50 py-1">
            {suggestions.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isKaraoke = item.toLowerCase().includes("karaoke") || item.toLowerCase().includes("beat");

              return (
                <li
                  key={index}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onMouseDown={(e) => handleSelectSuggestion(item, e)}
                  className={`group px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-rose-500/15 text-rose-300"
                      : "hover:bg-slate-850 text-slate-300"
                  }`}
                >
                  {/* Left: Icon & Highlighted Suggestion Text */}
                  <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        isKaraoke
                          ? "bg-rose-500/10 text-rose-400"
                          : "bg-slate-800 text-slate-400 group-hover:text-slate-300"
                      }`}
                    >
                      {isKaraoke ? (
                        <Music className="w-3.5 h-3.5" />
                      ) : (
                        <Search className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="text-xs truncate flex-1">
                      {renderHighlightedText(item, query)}
                    </div>
                  </div>

                  {/* Right: Quick Fill Arrow Button */}
                  <button
                    type="button"
                    onMouseDown={(e) => handleQuickFill(item, e)}
                    className="p-1 text-slate-500 hover:text-white rounded-lg hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                    title="Điền vào ô tìm kiếm"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
