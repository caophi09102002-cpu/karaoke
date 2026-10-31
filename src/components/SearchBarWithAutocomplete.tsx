"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  X,
  ArrowUpRight,
  Music,
  Loader2,
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
  placeholder = "Tìm bài hát, ca sĩ hoặc gõ tắt (VD: cdns, nhnt)...",
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
    const clean = query.trim();
    if (!clean) return;
    setIsOpen(false);
    onSearch(clean);
  };

  // Select suggestion item
  const handleSelectSuggestion = (selectedText: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    onChangeQuery(selectedText);
    setIsOpen(false);
    onSearch(selectedText);
  };

  // Quick fill into input without triggering search immediately
  const handleQuickFill = (text: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChangeQuery(text);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Clear input
  const handleClear = () => {
    onChangeQuery("");
    setSuggestions([]);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Keyboard navigation
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

  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;

    const cleanHighlight = highlight.trim();
    const parts = text.split(new RegExp(`(${cleanHighlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));

    return (
      <span className="truncate">
        {parts.map((part, i) =>
          part.toLowerCase() === cleanHighlight.toLowerCase() ? (
            <span key={i} className="font-semibold text-white">
              {part}
            </span>
          ) : (
            <span key={i} className="text-zinc-400 font-normal">
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
        <div className="absolute left-3.5 flex items-center pointer-events-none text-zinc-400">
          {isLoadingSuggestions || isSearching ? (
            <Loader2 className="w-4 h-4 text-zinc-300 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-zinc-400 stroke-[1.75]" />
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
          className="w-full bg-zinc-900/90 border border-white/[0.08] focus:border-zinc-400 rounded-xl pl-10 pr-20 py-3 text-[16px] md:text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors shadow-lg shadow-black/20"
        />

        {/* Right Buttons: Clear "X" and "Tìm" button */}
        <div className="absolute right-1.5 flex items-center gap-1">
          {query.trim() && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Xóa ô tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="submit"
            disabled={!query.trim() || isSearching}
            className="px-3 py-1.5 bg-white hover:bg-zinc-200 disabled:opacity-30 text-zinc-950 text-xs font-semibold rounded-lg transition-all cursor-pointer active:scale-95 shadow-sm"
          >
            {isSearching ? "Tìm..." : "Tìm"}
          </button>
        </div>
      </form>

      {/* Autocomplete Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-zinc-900/95 backdrop-blur-xl border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden animate-in fade-in duration-150">
          <ul className="max-h-64 overflow-y-auto divide-y divide-white/[0.04] py-1">
            {suggestions.map((item, index) => {
              const isSelected = index === selectedIndex;
              const isKaraoke = item.toLowerCase().includes("karaoke") || item.toLowerCase().includes("beat");

              return (
                <li
                  key={index}
                  onMouseEnter={() => setSelectedIndex(index)}
                  onMouseDown={(e) => handleSelectSuggestion(item, e)}
                  className={`group px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                    isSelected ? "bg-white/[0.08] text-white" : "hover:bg-white/[0.04] text-zinc-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                    <div className="p-1.5 rounded-md bg-white/[0.04] text-zinc-400 group-hover:text-zinc-200 shrink-0">
                      <Music className="w-3.5 h-3.5 stroke-[1.75]" />
                    </div>
                    <div className="text-xs truncate flex-1">
                      {renderHighlightedText(item, query)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onMouseDown={(e) => handleQuickFill(item, e)}
                    className="p-1 text-zinc-500 hover:text-white rounded-md hover:bg-white/[0.06] transition-colors shrink-0 cursor-pointer"
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
