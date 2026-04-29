"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
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
  const [open,      setOpen]      = useState(false);
  const [search,    setSearch]    = useState("");
  const [rect,      setRect]      = useState<DOMRect | null>(null);
  const [mounted,   setMounted]   = useState(false);

  const triggerRef   = useRef<HTMLButtonElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Hydration guard — portals need the DOM
  useEffect(() => { setMounted(true); }, []);

  // Focus search input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 20);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current  && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch("");
      }
    }
    // Small delay so the opening click doesn't immediately close
    const t = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", handler); };
  }, [open]);

  // Recalculate position on scroll / resize while open
  const updateRect = useCallback(() => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
  }, []);

  useEffect(() => {
    if (!open) return;
    updateRect();
    window.addEventListener("scroll",  updateRect, true);
    window.addEventListener("resize",  updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [open, updateRect]);

  function toggle() {
    if (disabled) return;
    if (open) {
      setOpen(false);
      setSearch("");
    } else {
      updateRect();
      setOpen(true);
    }
  }

  const filtered  = options.filter(o => o.toLowerCase().includes(search.toLowerCase()));
  const trimmed   = search.trim();
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
    if (e.key === "Escape") { setOpen(false); setSearch(""); }
  }

  // Portal dropdown — positioned with fixed coords derived from trigger
  const DROPDOWN_W = rect ? Math.max(rect.width, 200) : 240;
  const MENU_MAX_H = 280;
  const GAP = 4;

  // Decide whether to open upward or downward
  const spaceBelow = rect ? window.innerHeight - rect.bottom - GAP : 999;
  const openUpward = rect ? spaceBelow < MENU_MAX_H && rect.top > MENU_MAX_H : false;

  const dropdownStyle: React.CSSProperties = rect
    ? {
        position:  "fixed",
        zIndex:    99999,
        width:     DROPDOWN_W,
        left:      Math.min(rect.left, window.innerWidth - DROPDOWN_W - 8),
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + GAP }
          : { top:    rect.bottom + GAP }),
      }
    : { display: "none" };

  const dropdown = mounted && open && rect ? createPortal(
    <div ref={dropdownRef} style={dropdownStyle}
      className="bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
      {/* Search input */}
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

      {/* Options list */}
      <div style={{ maxHeight: MENU_MAX_H - 48 }} className="overflow-y-auto">
        {filtered.length === 0 && !canCreate && (
          <p className="px-4 py-3 text-xs text-stone-400 italic text-center">No options found</p>
        )}

        {filtered.map(opt => (
          <button key={opt} type="button" onClick={() => select(opt)}
            className={`w-full flex items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-stone-50 text-left ${
              opt === value ? "bg-[#0d9488]/5 text-[#0d9488] font-medium" : "text-stone-800"
            }`}>
            <span className="flex-1 min-w-0 leading-snug">{opt}</span>
            {opt === value && <Check className="w-3.5 h-3.5 shrink-0 ml-2 text-[#0d9488]" />}
          </button>
        ))}

        {/* Add new option */}
        {canCreate && (
          <button type="button" onClick={create}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#0d9488] hover:bg-[#0d9488]/5 transition-colors border-t border-stone-100">
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>Add <span className="font-semibold">"{trimmed}"</span></span>
          </button>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={toggle}
          className={`w-full flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 ${
            disabled
              ? "border-stone-100 text-stone-300 cursor-not-allowed"
              : open
              ? "border-[#0d9488]/40 ring-2 ring-[#0d9488]/20 cursor-pointer"
              : "border-stone-200 hover:border-stone-300 cursor-pointer"
          } ${!value ? "text-stone-400" : "text-stone-800"}`}
        >
          <span className="truncate flex-1 text-left">{value || placeholder}</span>
          <ChevronDown className={`w-4 h-4 shrink-0 text-stone-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {dropdown}
    </>
  );
}
