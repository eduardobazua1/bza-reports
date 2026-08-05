"use client";

import { useMemo, useState, type ReactNode } from "react";

type Row = {
  id: number;
  userId: number | null;
  userName: string | null;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  entityLabel: string | null;
  changes: string | null;
  meta: string | null;
  createdAt: string;
};
type UserOpt = { id: number; name: string | null; email: string };

const G = { d1: "#082826", d2: "#0d3d3b", d3: "#12514e", m: "#2f8a80", l1: "#5aa89e", l4: "#e6f1ee", ink: "#33544d" };

const ACTION: Record<string, { verb: string; color: string; bg: string }> = {
  create: { verb: "created", color: G.d2, bg: G.l4 },
  update: { verb: "edited", color: G.d3, bg: "#eef4f2" },
  delete: { verb: "deleted", color: "#b23b57", bg: "#fbeef1" },
  pay: { verb: "recorded payment", color: G.d2, bg: G.l4 },
  login: { verb: "signed in", color: G.m, bg: "#eef4f2" },
  logout: { verb: "signed out", color: "#8a8580", bg: "#f5f5f4" },
  view: { verb: "viewed", color: "#8a8580", bg: "#f5f5f4" },
  export: { verb: "exported", color: G.m, bg: G.l4 },
  send: { verb: "sent", color: G.m, bg: G.l4 },
};

const ENTITY_LABEL: Record<string, string> = {
  invoice: "invoice", purchase_order: "purchase order", client: "client", supplier: "supplier",
  supplier_payment: "supplier payment", customer_payment: "customer payment", user: "user", auth: "session",
};

function entityName(e: string) { return ENTITY_LABEL[e] ?? e.replace(/_/g, " "); }
function fieldName(f: string) { return f.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()).trim(); }
function fmtVal(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
}

export function ActivityLogView({ rows, users }: { rows: Row[]; users: UserOpt[] }) {
  const [q, setQ] = useState("");
  const [user, setUser] = useState("all");
  const [action, setAction] = useState("all");
  const [entity, setEntity] = useState("all");
  const [openId, setOpenId] = useState<number | null>(null);

  const entities = useMemo(() => [...new Set(rows.map((r) => r.entity))].sort(), [rows]);
  const actions = useMemo(() => [...new Set(rows.map((r) => r.action))].sort(), [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (user !== "all" && String(r.userId) !== user) return false;
      if (action !== "all" && r.action !== action) return false;
      if (entity !== "all" && r.entity !== entity) return false;
      if (needle) {
        const hay = `${r.userName ?? ""} ${r.userEmail ?? ""} ${r.entityLabel ?? ""} ${r.entity} ${r.action} ${r.changes ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, user, action, entity]);

  // Group by day
  const groups = useMemo(() => {
    const map: Record<string, Row[]> = {};
    for (const r of filtered) {
      const day = (r.createdAt || "").slice(0, 10);
      (map[day] ??= []).push(r);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [filtered]);

  return (
    <div className="space-y-4" style={{ color: G.ink }}>
      <div>
        <h1 className="text-2xl font-bold" style={{ color: G.d2 }}>Activity Log</h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-3 flex flex-wrap gap-2 items-center">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
          className="flex-1 min-w-[160px] border border-stone-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
          style={{ boxShadow: "none" }}
        />
        <Select value={user} onChange={setUser} label="User">
          <option value="all">All users</option>
          {users.map((u) => <option key={u.id} value={String(u.id)}>{u.name || u.email}</option>)}
        </Select>
        <Select value={action} onChange={setAction} label="Action">
          <option value="all">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{ACTION[a]?.verb ?? a}</option>)}
        </Select>
        <Select value={entity} onChange={setEntity} label="Type">
          <option value="all">All types</option>
          {entities.map((e) => <option key={e} value={e}>{entityName(e)}</option>)}
        </Select>
        <span className="text-xs text-stone-400 tabular-nums ml-auto">{filtered.length} events</span>
      </div>

      {groups.length === 0 && (
        <div className="bg-white rounded-xl border border-stone-100 shadow-sm p-10 text-center text-stone-400 text-sm">
          No activity yet. Actions will appear here as you and your team work.
        </div>
      )}

      {groups.map(([day, items]) => (
        <div key={day} className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400 px-1">{formatDay(day)}</p>
          <div className="bg-white rounded-xl border border-stone-100 shadow-sm divide-y divide-stone-100">
            {items.map((r) => {
              const a = ACTION[r.action] ?? { verb: r.action, color: G.ink, bg: "#f5f5f4" };
              const changeList = parseChanges(r.changes);
              const meta = parseMeta(r.meta);
              const canOpen = changeList.length > 0 || !!meta;
              const open = openId === r.id;
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className={`flex items-start gap-3 ${canOpen ? "cursor-pointer" : ""}`} onClick={() => canOpen && setOpenId(open ? null : r.id)}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-none mt-0.5"
                      style={{ background: G.l4, color: G.d2 }}>
                      {(r.userName || r.userEmail || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-semibold" style={{ color: G.ink }}>{r.userName || r.userEmail || "Unknown"}</span>
                        {" "}
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: a.bg, color: a.color }}>{a.verb}</span>
                        {" "}
                        <span className="text-stone-500">{entityName(r.entity)}</span>
                        {r.entityLabel && <span className="font-semibold" style={{ color: G.d3 }}> {r.entityLabel}</span>}
                        {changeList.length > 0 && <span className="text-stone-400 text-xs"> · {changeList.length} field{changeList.length > 1 ? "s" : ""}</span>}
                      </p>
                      {open && changeList.length > 0 && (
                        <div className="mt-2 rounded-lg bg-stone-50 border border-stone-100 divide-y divide-stone-100">
                          {changeList.map((c, i) => (
                            <div key={i} className="grid grid-cols-[130px_1fr] gap-2 px-3 py-1.5 text-xs items-center">
                              <span className="text-stone-500">{fieldName(c.field)}</span>
                              <span className="flex items-center gap-2 flex-wrap">
                                <span className="line-through text-stone-400">{fmtVal(c.before)}</span>
                                <span className="text-stone-300">→</span>
                                <span className="font-semibold" style={{ color: G.d2 }}>{fmtVal(c.after)}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      {open && meta && (
                        <pre className="mt-2 rounded-lg bg-stone-50 border border-stone-100 px-3 py-2 text-[11px] text-stone-500 overflow-x-auto">{JSON.stringify(meta, null, 1)}</pre>
                      )}
                    </div>
                    <span className="text-[11px] text-stone-400 tabular-nums flex-none">{formatTime(r.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: ReactNode }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}
      className="border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm bg-white text-stone-600 focus:outline-none">
      {children}
    </select>
  );
}

function parseChanges(s: string | null): { field: string; before: unknown; after: unknown }[] {
  if (!s) return [];
  try { const v = JSON.parse(s); return Array.isArray(v) ? v : []; } catch { return []; }
}
function parseMeta(s: string | null): Record<string, unknown> | null {
  if (!s) return null;
  try { return JSON.parse(s); } catch { return null; }
}
function formatDay(day: string) {
  if (!day) return "";
  const today = new Date().toISOString().slice(0, 10);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (day === today) return "Today";
  if (day === y) return "Yesterday";
  const [Y, M, D] = day.split("-");
  return `${["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(M)]} ${Number(D)}, ${Y}`;
}
function formatTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
