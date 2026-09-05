"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Plus, Trash2, ArrowLeft } from "lucide-react";

type Memory = {
  id: number; fact: string; topic: string | null; source: string;
  active: boolean; createdAt: string; updatedAt: string;
};

export default function MemoryPage() {
  const [items, setItems] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newFact, setNewFact] = useState("");
  const [newTopic, setNewTopic] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/ai/memory");
    setItems(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!newFact.trim()) return;
    await fetch("/api/ai/memory", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact: newFact.trim(), topic: newTopic.trim() || null }),
    });
    setNewFact(""); setNewTopic(""); load();
  }
  async function toggle(m: Memory) {
    await fetch(`/api/ai/memory/${m.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !m.active }),
    });
    load();
  }
  async function saveFact(m: Memory, fact: string) {
    if (fact === m.fact) return;
    await fetch(`/api/ai/memory/${m.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fact }),
    });
    load();
  }
  async function remove(m: Memory) {
    if (!confirm("Delete this memory permanently?")) return;
    await fetch(`/api/ai/memory/${m.id}`, { method: "DELETE" });
    load();
  }

  const active = items.filter((m) => m.active);
  const inactive = items.filter((m) => !m.active);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <Link href="/assistant" className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-2"><ArrowLeft className="w-3.5 h-3.5" /> Back to BZA Intelligence</Link>
        <h1 className="text-2xl font-bold text-stone-800 flex items-center gap-2"><Brain className="w-6 h-6 text-[#0d3d3b]" /> What the AI remembers</h1>
        <p className="text-sm text-stone-500">Durable business rules the assistant applies automatically in every conversation. Edit, add, or turn any off.</p>
      </div>

      {/* Add */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 space-y-2">
        <textarea value={newFact} onChange={(e) => setNewFact(e.target.value)} rows={2}
          placeholder="Teach the AI a rule, e.g. 'Vendor X = commission agent for client Y → OpEx, subcategory Commission - Y'"
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none" />
        <div className="flex items-center gap-2">
          <input value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="topic (optional): commissions, entities…"
            className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm" />
          <button onClick={add} disabled={!newFact.trim()}
            className="flex items-center gap-1.5 bg-[#0d3d3b] text-white rounded-lg px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {loading ? <p className="text-stone-500">Loading…</p> : (
        <>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Active ({active.length})</div>
            {active.map((m) => (
              <MemoryRow key={m.id} m={m} onToggle={toggle} onSave={saveFact} onRemove={remove} />
            ))}
          </div>
          {inactive.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-stone-400">Off ({inactive.length})</div>
              {inactive.map((m) => (
                <MemoryRow key={m.id} m={m} onToggle={toggle} onSave={saveFact} onRemove={remove} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MemoryRow({ m, onToggle, onSave, onRemove }: {
  m: Memory; onToggle: (m: Memory) => void; onSave: (m: Memory, fact: string) => void; onRemove: (m: Memory) => void;
}) {
  const [draft, setDraft] = useState(m.fact);
  return (
    <div className={`bg-white rounded-xl border p-3 flex items-start gap-3 ${m.active ? "border-stone-200" : "border-stone-200 opacity-60"}`}>
      <div className="flex-1 min-w-0">
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => onSave(m, draft.trim())} rows={2}
          className="w-full text-sm text-stone-700 resize-none border border-transparent hover:border-stone-200 focus:border-stone-300 rounded-lg px-2 py-1 focus:outline-none" />
        <div className="flex items-center gap-2 mt-1 px-2">
          {m.topic && <span className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#e6f1ee] text-[#0d3d3b]">{m.topic}</span>}
          <span className="text-[10px] text-stone-400">#{m.id} · {m.source}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={() => onToggle(m)} title={m.active ? "Turn off" : "Turn on"}
          className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border ${m.active ? "border-[#0d3d3b] text-[#0d3d3b]" : "border-stone-300 text-stone-400"}`}>
          {m.active ? "On" : "Off"}
        </button>
        <button onClick={() => onRemove(m)} className="text-stone-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
