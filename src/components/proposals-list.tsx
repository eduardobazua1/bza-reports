"use client";

import Link from "next/link";
import { useState } from "react";
import { FileText, Plus, Search } from "lucide-react";

type Proposal = {
  id: number;
  proposalNumber: string;
  clientName: string | null;
  title: string;
  proposalDate: string;
  validUntil: string | null;
  status: string;
  incoterm: string | null;
  paymentTerms: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-stone-100 text-stone-500",
  sent:     "bg-blue-50 text-blue-600",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-600",
};

function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("T")[0].split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}

export function ProposalsList({ proposals }: { proposals: Proposal[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = proposals.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || p.proposalNumber.toLowerCase().includes(q)
      || (p.clientName || "").toLowerCase().includes(q)
      || p.title.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all:      proposals.length,
    draft:    proposals.filter(p => p.status === "draft").length,
    sent:     proposals.filter(p => p.status === "sent").length,
    accepted: proposals.filter(p => p.status === "accepted").length,
    declined: proposals.filter(p => p.status === "declined").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proposals</h1>
          <p className="text-sm text-stone-400 mt-0.5">{proposals.length} total</p>
        </div>
        <Link
          href="/proposals/new"
          className="flex items-center gap-2 bg-[#0d3d3b] hover:bg-[#0a5c5a] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Proposal
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 border-b border-stone-200">
        {(["all","draft","sent","accepted","declined"] as const).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`pb-2.5 px-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              statusFilter === s
                ? "border-[#0d9488] text-[#0d9488]"
                : "border-transparent text-stone-500 hover:text-stone-700"
            }`}
          >
            {s}{" "}
            <span className="text-xs text-stone-400">({counts[s]})</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          placeholder="Search proposals…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-stone-400">
            <FileText className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">No proposals found</p>
            {proposals.length === 0 && (
              <Link href="/proposals/new" className="mt-4 text-sm text-[#0d9488] hover:underline">
                Create your first proposal →
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100 text-left">
                <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Number</th>
                <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Title</th>
                <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Valid Until</th>
                <th className="px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-stone-700">{p.proposalNumber}</td>
                  <td className="px-4 py-3 text-stone-700">{p.clientName || "—"}</td>
                  <td className="px-4 py-3 text-stone-600 max-w-[200px] truncate">{p.title}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">{fmtDate(p.proposalDate)}</td>
                  <td className="px-4 py-3 text-stone-500 text-xs whitespace-nowrap">{fmtDate(p.validUntil)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[p.status] || "bg-stone-100 text-stone-500"}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/proposals/${p.id}`}
                      className="text-xs text-[#0d9488] hover:underline font-medium"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
