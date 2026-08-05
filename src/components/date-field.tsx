"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DOW = ["Mo","Tu","We","Th","Fr","Sa","Su"];

// Parse a "YYYY-MM-DD" string into numeric parts without timezone drift.
function parseISO(v: string | null | undefined): { y: number; m: number; d: number } | null {
  if (!v) return null;
  const p = v.split("T")[0].split("-");
  if (p.length < 3) return null;
  const y = Number(p[0]), m = Number(p[1]), d = Number(p[2]);
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// English display, unambiguous: "Jul 8, 2026"
function label(v: string | null | undefined) {
  const p = parseISO(v);
  if (!p) return "";
  return `${MONTHS_SHORT[p.m - 1]} ${p.d}, ${p.y}`;
}

/**
 * Drop-in replacement for <input type="date"> that always renders an English
 * calendar (the native picker follows the browser/OS locale, which shows Spanish
 * here). Emits and accepts "YYYY-MM-DD" strings, same as the native input.
 */
export function DateField({
  value,
  onChange,
  defaultValue,
  name,
  required,
  className,
  placeholder = "Select date",
}: {
  // Controlled mode: pass value + onChange.
  value?: string;
  onChange?: (v: string) => void;
  // Uncontrolled mode (for <form> + FormData): pass name (+ optional defaultValue).
  // A hidden input carries the value so formData.get(name) works like a native input.
  defaultValue?: string;
  name?: string;
  required?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [internal, setInternal] = useState(defaultValue ?? "");
  // Controlled if a value prop was provided; otherwise manage our own state.
  const current = value !== undefined ? value : internal;
  const emit = (v: string) => {
    if (onChange) onChange(v);
    if (value === undefined) setInternal(v);
  };
  const selected = parseISO(current);
  // Which month the calendar is viewing
  const today = new Date();
  const [view, setView] = useState(() => selected
    ? { y: selected.y, m: selected.m }
    : { y: today.getFullYear(), m: today.getMonth() + 1 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !popRef.current?.contains(t)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function openCal() {
    const s = parseISO(current);
    setView(s ? { y: s.y, m: s.m } : { y: today.getFullYear(), m: today.getMonth() + 1 });
    const r = btnRef.current!.getBoundingClientRect();
    const calH = 300, calW = 248;
    const spaceBelow = window.innerHeight - r.bottom;
    const top = spaceBelow < calH ? Math.max(8, r.top - calH - 4) : r.bottom + 4;
    const left = Math.min(r.left, window.innerWidth - calW - 8);
    setPos({ top, left: Math.max(8, left) });
    setOpen(true);
  }

  function pick(d: number) {
    emit(toISO(view.y, view.m, d));
    setOpen(false);
  }

  function shiftMonth(delta: number) {
    setView((v) => {
      let m = v.m + delta, y = v.y;
      if (m < 1) { m = 12; y--; }
      if (m > 12) { m = 1; y++; }
      return { y, m };
    });
  }

  // Build the grid (Monday-first, matching the app's earlier calendar)
  const firstDow = (new Date(view.y, view.m - 1, 1).getDay() + 6) % 7; // 0=Mon
  const daysInMonth = new Date(view.y, view.m, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isToday = (d: number) =>
    view.y === today.getFullYear() && view.m === today.getMonth() + 1 && d === today.getDate();
  const isSelected = (d: number) =>
    !!selected && selected.y === view.y && selected.m === view.m && selected.d === d;

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        onClick={() => (open ? setOpen(false) : openCal())}
        className={`flex items-center justify-between text-left ${className ?? "w-full border border-stone-200 rounded px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#0d3d3b]"}`}
      >
        <span className={selected ? "text-stone-800" : "text-stone-400"}>
          {selected ? label(current) : placeholder}
        </span>
        <svg className="w-3.5 h-3.5 text-stone-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {name && <input type="hidden" name={name} value={current} readOnly />}
      {open && pos && createPortal(
        <div
          ref={popRef}
          data-datefield-popup=""
          onMouseDown={(e) => e.stopPropagation()}
          style={{ position: "fixed", top: pos.top, left: pos.left, width: 248, zIndex: 9999 }}
          className="bg-white border border-stone-200 rounded-lg shadow-xl p-3 select-none"
        >
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="p-1 rounded hover:bg-stone-100 text-stone-500">‹</button>
            <span className="text-sm font-semibold text-stone-800">{MONTHS[view.m - 1]} {view.y}</span>
            <button type="button" onClick={() => shiftMonth(1)} className="p-1 rounded hover:bg-stone-100 text-stone-500">›</button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {DOW.map((d) => (
              <div key={d} className="text-[10px] text-stone-400 text-center font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => d === null ? (
              <div key={`e${i}`} />
            ) : (
              <button
                key={d}
                type="button"
                onClick={() => pick(d)}
                className={`text-xs rounded py-1.5 text-center transition-colors ${
                  isSelected(d)
                    ? "bg-[#0d3d3b] text-white font-semibold"
                    : isToday(d)
                    ? "border border-[#0d3d3b] text-[#0d3d3b] hover:bg-stone-50"
                    : "text-stone-700 hover:bg-stone-100"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-stone-100">
            <button type="button" onClick={() => { emit(""); setOpen(false); }} className="text-xs text-stone-500 hover:text-stone-700">Clear</button>
            <button
              type="button"
              onClick={() => { emit(toISO(today.getFullYear(), today.getMonth() + 1, today.getDate())); setOpen(false); }}
              className="text-xs text-[#0d3d3b] font-medium hover:underline"
            >
              Today
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
