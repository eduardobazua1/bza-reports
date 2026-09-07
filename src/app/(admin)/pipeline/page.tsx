"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, X, Trash2, GripVertical, FileText } from "lucide-react";

type Stage = "prospecto" | "cotizacion" | "muestra" | "negociacion" | "ganado" | "perdido";
interface Opp {
  id: number; title: string; clientId: number | null; clientName: string | null;
  product: string | null; incoterm: string | null; estimatedTons: number; pricePerTon: number; stage: Stage;
  probability: number; proposalId: number | null; expectedCloseDate: string | null; notes: string | null; lostReason: string | null;
}
interface ClientOpt { id: number; name: string }

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "prospecto", label: "Prospect", color: "#c2e0da" },
  { key: "cotizacion", label: "Quote", color: "#7bb3aa" },
  { key: "muestra", label: "Sample/Approval", color: "#4a9d92" },
  { key: "negociacion", label: "Negotiation", color: "#2f8a80" },
  { key: "ganado", label: "Won", color: "#0d3d3b" },
  { key: "perdido", label: "Lost", color: "#a8a29e" },
];
const OPEN: Stage[] = ["prospecto", "cotizacion", "muestra", "negociacion"];
const INCOTERMS = ["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"];

const usd = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const val = (o: Opp) => o.estimatedTons * o.pricePerTon;

const emptyForm = { id: 0, title: "", clientId: "", clientName: "", product: "", incoterm: "", estimatedTons: "", pricePerTon: "", stage: "prospecto" as Stage, probability: "", expectedCloseDate: "", notes: "", lostReason: "", proposalId: 0 };

export default function PipelinePage() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);
  const [modal, setModal] = useState<null | typeof emptyForm>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [o, c] = await Promise.all([fetch("/api/pipeline"), fetch("/api/clients")]);
    setOpps(await o.json());
    setClients(await c.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function move(id: number, stage: Stage) {
    setOpps((prev) => prev.map((o) => (o.id === id ? { ...o, stage } : o))); // optimistic
    await fetch(`/api/pipeline/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
    load();
  }

  async function saveForm() {
    if (!modal) return;
    const clientDisplay = modal.clientId ? (clients.find((c) => String(c.id) === modal.clientId)?.name ?? "") : modal.clientName;
    const title = modal.title.trim() || [clientDisplay, modal.product].filter(Boolean).join(" — ") || "New opportunity";
    const payload = {
      title, clientId: modal.clientId || null, clientName: modal.clientId ? null : modal.clientName,
      product: modal.product, incoterm: modal.incoterm, estimatedTons: Number(modal.estimatedTons) || 0, pricePerTon: Number(modal.pricePerTon) || 0,
      stage: modal.stage, expectedCloseDate: modal.expectedCloseDate || null, notes: modal.notes,
      ...(modal.probability !== "" ? { probability: Number(modal.probability) } : {}),
      ...(modal.stage === "perdido" ? { lostReason: modal.lostReason } : {}),
    };
    if (modal.id) await fetch(`/api/pipeline/${modal.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    else await fetch("/api/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setModal(null); load();
  }
  async function del(id: number) {
    if (!confirm("Delete this opportunity?")) return;
    await fetch(`/api/pipeline/${id}`, { method: "DELETE" });
    setModal(null); load();
  }
  async function createQuote() {
    if (!modal?.id) return;
    if (!modal.clientId) { alert("Pick an existing client on this deal first — a quote/proposal requires a real client."); return; }
    // save current edits, then generate the linked proposal
    await saveForm();
    const res = await fetch(`/api/pipeline/${modal.id}/quote`, { method: "POST" });
    const d = await res.json();
    if (!res.ok) { alert(d.error || "Could not create the quote."); return; }
    window.open(`/proposals/${d.proposalId}`, "_blank");
  }
  function openEdit(o: Opp) {
    setModal({ id: o.id, title: o.title, clientId: o.clientId ? String(o.clientId) : "", clientName: o.clientName || "",
      product: o.product || "", incoterm: o.incoterm || "", estimatedTons: String(o.estimatedTons || ""), pricePerTon: String(o.pricePerTon || ""),
      stage: o.stage, probability: String(o.probability), expectedCloseDate: o.expectedCloseDate || "", notes: o.notes || "", lostReason: o.lostReason || "", proposalId: o.proposalId || 0 });
  }

  const open = opps.filter((o) => OPEN.includes(o.stage));
  const openValue = open.reduce((s, o) => s + val(o), 0);
  const weighted = open.reduce((s, o) => s + val(o) * (o.probability / 100), 0);
  const wonValue = opps.filter((o) => o.stage === "ganado").reduce((s, o) => s + val(o), 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Pipeline</h1>
          <p className="text-sm text-stone-500">Sales opportunities by stage. Drag a card to move it; the forecast is value × probability.</p>
        </div>
        <button onClick={() => setModal({ ...emptyForm })} className="flex items-center gap-1.5 bg-[#0d3d3b] text-white rounded-lg px-3 py-2 text-sm font-medium hover:opacity-90">
          <Plus className="w-4 h-4" /> New opportunity
        </button>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl p-4 text-white" style={{ background: "linear-gradient(155deg, #12514e, #082826)" }}>
          <p className="text-[11px] uppercase tracking-wider text-white/60 font-bold">Open pipeline</p>
          <p className="text-3xl font-extrabold tabular-nums mt-1">{usd(openValue)}</p>
          <p className="text-xs text-white/70 mt-0.5">{open.length} deals</p>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-stone-200">
          <p className="text-[11px] uppercase tracking-wider text-stone-400 font-bold">Weighted forecast</p>
          <p className="text-3xl font-extrabold tabular-nums mt-1 text-[#0d3d3b]">{usd(weighted)}</p>
          <p className="text-xs text-stone-400 mt-0.5">value × probability</p>
        </div>
        <div className="rounded-2xl p-4 bg-white border border-stone-200">
          <p className="text-[11px] uppercase tracking-wider text-stone-400 font-bold">Won</p>
          <p className="text-3xl font-extrabold tabular-nums mt-1 text-[#0d3d3b]">{usd(wonValue)}</p>
          <p className="text-xs text-stone-400 mt-0.5">{opps.filter((o) => o.stage === "ganado").length} deals</p>
        </div>
      </div>

      {loading ? <p className="text-stone-500">Loading…</p> : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map((st) => {
            const cards = opps.filter((o) => o.stage === st.key);
            const total = cards.reduce((s, o) => s + val(o), 0);
            return (
              <div
                key={st.key}
                onDragOver={(e) => { e.preventDefault(); setOverStage(st.key); }}
                onDragLeave={() => setOverStage((s) => (s === st.key ? null : s))}
                onDrop={() => { if (dragId != null) move(dragId, st.key); setDragId(null); setOverStage(null); }}
                className={`w-64 shrink-0 rounded-xl border ${overStage === st.key ? "border-[#0d3d3b] bg-[#e6f1ee]" : "border-stone-200 bg-stone-50"}`}
              >
                <div className="flex items-center justify-between px-3 py-2 border-b border-stone-200">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: st.color }} />
                    <span className="text-sm font-semibold text-stone-700">{st.label}</span>
                    <span className="text-xs text-stone-400">{cards.length}</span>
                  </div>
                  <span className="text-xs font-medium text-stone-500 tabular-nums">{usd(total)}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {cards.map((o) => (
                    <div
                      key={o.id}
                      draggable
                      onDragStart={() => setDragId(o.id)}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      onClick={() => openEdit(o)}
                      className="group bg-white rounded-lg border border-stone-200 p-2.5 shadow-sm cursor-pointer hover:border-[#0d3d3b]"
                    >
                      <div className="flex items-start gap-1">
                        <GripVertical className="w-3.5 h-3.5 text-stone-300 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-stone-800 truncate">{o.title}</div>
                          <div className="text-xs text-stone-500 truncate">{o.clientName || "—"}{o.product ? ` · ${o.product}` : ""}{o.incoterm ? ` · ${o.incoterm}` : ""}</div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <span className="text-sm font-bold text-[#0d3d3b] tabular-nums">{usd(val(o))}</span>
                            {!["ganado", "perdido"].includes(o.stage) && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-[#e6f1ee] text-[#0d3d3b]">{o.probability}%</span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-stone-400">
                            <span className="flex items-center gap-1">{o.estimatedTons ? `${o.estimatedTons.toLocaleString()} t × $${o.pricePerTon}` : ""}{o.proposalId ? <FileText className="w-3 h-3 text-[#0d3d3b]" /> : null}</span>
                            {o.expectedCloseDate && <span>{o.expectedCloseDate}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {cards.length === 0 && <p className="text-[11px] text-stone-300 text-center py-4">Drop here</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-stone-800">{modal.id ? "Edit opportunity" : "New opportunity"}</h2>
              <button onClick={() => setModal(null)} className="text-stone-400 hover:text-stone-700"><X className="w-5 h-5" /></button>
            </div>
            <input value={modal.title} onChange={(e) => setModal({ ...modal, title: e.target.value })} placeholder="Deal title (optional — auto from client + product)"
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-stone-600">Client
                <select value={modal.clientId} onChange={(e) => setModal({ ...modal, clientId: e.target.value })}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-2 text-sm">
                  <option value="">— Prospect (type name) —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="text-xs text-stone-600">Product
                <input value={modal.product} onChange={(e) => setModal({ ...modal, product: e.target.value })}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-stone-600">Incoterm
                <select value={modal.incoterm} onChange={(e) => setModal({ ...modal, incoterm: e.target.value })}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-2 text-sm">
                  <option value="">—</option>
                  {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
            </div>
            {!modal.clientId && (
              <input value={modal.clientName} onChange={(e) => setModal({ ...modal, clientName: e.target.value })} placeholder="Prospect name"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
            )}
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-stone-600">Est. tons
                <input type="number" value={modal.estimatedTons} onChange={(e) => setModal({ ...modal, estimatedTons: e.target.value })}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-stone-600">$/ton
                <input type="number" value={modal.pricePerTon} onChange={(e) => setModal({ ...modal, pricePerTon: e.target.value })}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-stone-600">Value
                <div className="mt-1 px-2 py-2 text-sm font-semibold text-[#0d3d3b] tabular-nums">{usd((Number(modal.estimatedTons) || 0) * (Number(modal.pricePerTon) || 0))}</div>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-stone-600">Stage
                <select value={modal.stage} onChange={(e) => setModal({ ...modal, stage: e.target.value as Stage, probability: "" })}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-2 text-sm">
                  {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </label>
              <label className="text-xs text-stone-600">Probability %
                <input type="number" value={modal.probability} onChange={(e) => setModal({ ...modal, probability: e.target.value })} placeholder="auto"
                  className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-2 text-sm" />
              </label>
              <label className="text-xs text-stone-600">Expected close
                <input type="date" value={modal.expectedCloseDate} onChange={(e) => setModal({ ...modal, expectedCloseDate: e.target.value })}
                  className="mt-1 w-full border border-stone-300 rounded-lg px-2 py-2 text-sm" />
              </label>
            </div>
            {modal.stage === "perdido" && (
              <input value={modal.lostReason} onChange={(e) => setModal({ ...modal, lostReason: e.target.value })} placeholder="Lost reason"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
            )}
            <textarea value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} placeholder="Notes" rows={2}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none" />
            <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
              {modal.id ? <button onClick={() => del(modal.id)} className="flex items-center gap-1.5 text-red-600 text-sm hover:underline"><Trash2 className="w-4 h-4" /> Delete</button> : <span />}
              <div className="flex items-center gap-2">
                {modal.id > 0 && (modal.proposalId ? (
                  <a href={`/proposals/${modal.proposalId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 border border-[#0d3d3b] text-[#0d3d3b] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#e6f1ee]">
                    <FileText className="w-4 h-4" /> View quote
                  </a>
                ) : modal.clientId ? (
                  <button onClick={createQuote} className="flex items-center gap-1.5 border border-[#0d3d3b] text-[#0d3d3b] rounded-lg px-4 py-2 text-sm font-medium hover:bg-[#e6f1ee]">
                    <FileText className="w-4 h-4" /> Create quote
                  </button>
                ) : null)}
                <button onClick={saveForm} disabled={!modal.clientId && !modal.clientName.trim() && !modal.title.trim()} className="bg-[#0d3d3b] text-white rounded-lg px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
