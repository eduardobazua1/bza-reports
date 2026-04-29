"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  onAddOption?: (option: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CreatableSelect({
  value,
  onChange,
  options,
  onAddOption,
  placeholder = "Select…",
  className = "",
  disabled = false,
}: CreatableSelectProps) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Focus the search input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const trimmed  = search.trim();
  const canCreate = trimmed.length > 0 && !options.some(o => o.toLowerCase() === trimmed.toLowerCase());

  function select(opt: string) {
    onChange(opt);
    setOpen(false);
    setSearch("");
  }

  function create() {
    if (!trimmed) return;
    onAddOption?.(trimmed);
    select(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canCreate) create();
      else if (filtered.length > 0) select(filtered[0]);
    }
    if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 ${
          disabled
            ? "border-stone-100 text-stone-300 cursor-not-allowed"
            : "border-stone-200 hover:border-stone-300 cursor-pointer"
        } ${!value ? "text-stone-400" : "text-stone-800"}`}
      >
        <span className="truncate flex-1 text-left">{value || placeholder}</span>
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-stone-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-[200] top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-stone-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search or type to add…"
              className="w-full px-2.5 py-1.5 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30"
            />
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && !canCreate && (
              <p className="px-4 py-3 text-xs text-stone-400 italic text-center">No options found</p>
            )}

            {filtered.map(opt => (
              <button
                key={opt}
                type="button"
                onClick={() => select(opt)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors hover:bg-stone-50 ${
                  opt === value ? "text-[#0d9488] font-medium" : "text-stone-700"
                }`}
              >
                <span className="truncate">{opt}</span>
                {opt === value && <Check className="w-3.5 h-3.5 shrink-0 text-[#0d9488]" />}
              </button>
            ))}

            {/* Create new option */}
            {canCreate && (
              <button
                type="button"
                onClick={create}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#0d9488] hover:bg-[#0d9488]/5 transition-colors border-t border-stone-100"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Add <span className="font-semibold">"{trimmed}"</span>
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
