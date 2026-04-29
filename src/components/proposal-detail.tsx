"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Send, Pencil, Trash2, ChevronLeft, Check, X, MailIcon } from "lucide-react";
import { updateProposalStatus, deleteProposal } from "@/server/actions";

// ── Types ─────────────────────────────────────────────────────────────────────
type Item = {
  id: number;
  sort: number;
  product: string;
  description: string | null;
  tons: number;
  unit: string;
  pricePerTon: number;
  certType: string | null;
  certDetail: string | null;
};

type ProposalData = {
  id: number;
  proposalNumber: string;
  clientId: number;
  title: string;
  proposalDate: string;
  validUntil: string | null;
  status: string;
  incoterm: string | null;
  paymentTerms: string | null;
  notes: string | null;
  client: { id: number; name: string; contactEmail: string | null; contactName: string | null } | null | undefined;
  items: Item[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(s: string | null) {
  if (!s) return "—";
  const [y, m, d] = s.split("T")[0].split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m)-1]} ${parseInt(d)}, ${y}`;
}
function fmtUsd(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtNum(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const STATUS_STYLES: Record<string, string> = {
  draft:    "bg-stone-100 text-stone-600",
  sent:     "bg-blue-50 text-blue-600",
  accepted: "bg-emerald-50 text-emerald-700",
  declined: "bg-red-50 text-red-600",
};

// ── Send Modal ─────────────────────────────────────────────────────────────────
function SendModal({ proposal, onClose }: { proposal: ProposalData; onClose: () => void }) {
  const [to,      setTo]      = useState(proposal.client?.contactEmail || "");
  const [cc,      setCc]      = useState("");
  const [subject, setSubject] = useState(`Proposal ${proposal.proposalNumber} — BZA International Services`);
  const [message, setMessage] = useState("");
  const [busy,    setBusy]    = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSend() {
    if (!to) { setError("Recipient email is required"); return; }
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/proposal-pdf/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id, to, cc: cc || undefined, subject, message: message || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      setDone(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MailIcon className="w-4 h-4 text-[#0d9488]" />
            <span className="font-semibold text-stone-800">Send Proposal</span>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600"><X className="w-5 h-5" /></button>
        </div>

        {done ? (
          <div className="px-6 py-10 flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mb-2">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-stone-800">Proposal sent!</p>
            <p className="text-sm text-stone-400">Status updated to <em>Sent</em>.</p>
          </div>
        ) : (
          <div className="px-6 py-4 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-700">{error}</div>}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">To *</label>
              <input type="email" value={to} onChange={e => setTo(e.target.value)}
                placeholder="client@example.com"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">CC</label>
              <input type="text" value={cc} onChange={e => setCc(e.target.value)}
                placeholder="optional"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Message <span className="text-stone-300">(optional)</span></label>
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
                placeholder="Custom message to prepend before the default email body…"
                className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={onClose} className="px-4 py-2 text-sm text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50">Cancel</button>
              <button onClick={handleSend} disabled={busy}
                className="flex items-center gap-2 px-5 py-2 bg-[#0d3d3b] hover:bg-[#0a5c5a] text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors">
                <Send className="w-3.5 h-3.5" />
                {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function ProposalDetail({ proposal }: { proposal: ProposalData }) {
  const router = useRouter();
  const [showSend,  setShowSend]  = useState(false);
  const [pending,   startTransition] = useTransition();
  const [delConfirm, setDelConfirm] = useState(false);

  const grandTotal = proposal.items.reduce((s, i) => s + i.tons * i.pricePerTon, 0);

  function handleDownload() {
    window.open(`/api/proposal-pdf?id=${proposal.id}`, "_blank");
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteProposal(proposal.id);
      router.push("/proposals");
    });
  }

  function handleStatusChange(newStatus: "draft"|"sent"|"accepted"|"declined") {
    startTransition(async () => {
      await updateProposalStatus(proposal.id, newStatus);
      router.refresh();
    });
  }

  return (
    <>
      {showSend && <SendModal proposal={proposal} onClose={() => { setShowSend(false); router.refresh(); }} />}

      <div className="space-y-6 max-w-5xl">
        {/* Breadcrumb + actions */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/proposals" className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 mb-1">
              <ChevronLeft className="w-3.5 h-3.5" />
              Proposals
            </Link>
            <h1 className="text-2xl font-bold">{proposal.proposalNumber}</h1>
            <p className="text-sm text-stone-400 mt-0.5">{proposal.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-lg text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              onClick={() => setShowSend(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#0d9488] hover:bg-[#0b7a71] text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
              Send
            </button>
            <Link
              href={`/proposals/${proposal.id}/edit`}
              className="flex items-center gap-2 px-4 py-2 bg-[#0d3d3b] hover:bg-[#0a5c5a] text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
          </div>
        </div>

        {/* Proposal header card */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6">
            {[
              { label: "Client",         value: proposal.client?.name || "—" },
              { label: "Proposal Date",  value: fmtDate(proposal.proposalDate) },
              { label: "Valid Until",    value: fmtDate(proposal.validUntil) },
              { label: "Incoterm",       value: proposal.incoterm || "—" },
              { label: "Payment Terms",  value: proposal.paymentTerms || "—" },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-0.5">{label}</dt>
                <dd className="text-sm text-stone-800">{value}</dd>
              </div>
            ))}

            {/* Status with quick-change buttons */}
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-stone-400 font-semibold mb-1">Status</dt>
              <dd className="flex flex-wrap gap-1.5">
                {(["draft","sent","accepted","declined"] as const).map(s => (
                  <button
                    key={s}
                    disabled={pending}
                    onClick={() => handleStatusChange(s)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium capitalize transition-all border ${
                      proposal.status === s
                        ? `${STATUS_STYLES[s]} border-transparent`
                        : "border-stone-100 text-stone-400 hover:border-stone-200 hover:text-stone-600 bg-stone-50"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </dd>
            </div>
          </div>
        </div>

        {/* Line items table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-stone-100">
            <h2 className="text-sm font-semibold text-stone-700">Line Items</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-[#0d3d3b] text-white text-xs uppercase tracking-wide">
                  <th className="px-4 py-2.5 text-center w-8">#</th>
                  <th className="px-4 py-2.5 text-left">Item</th>
                  <th className="px-4 py-2.5 text-right w-24">Qty</th>
                  <th className="px-4 py-2.5 text-center w-16">Unit</th>
                  <th className="px-4 py-2.5 text-right w-28">Price / MT</th>
                  <th className="px-4 py-2.5 text-right w-28">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {proposal.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-stone-400">No line items</td>
                  </tr>
                ) : proposal.items.map((item, idx) => {
                  const lineTotal = item.tons * item.pricePerTon;
                  return (
                    <tr key={item.id} className={idx % 2 === 1 ? "bg-stone-50/50" : ""}>
                      <td className="px-4 py-3 text-center text-xs text-stone-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-stone-800">{item.product}</div>
                        {item.description && item.description !== "—" && (
                          <div className="text-xs text-stone-400 mt-0.5">{item.description}</div>
                        )}
                        {item.certType && item.certType !== "None" && (
                          <span className="inline-block mt-1 text-[9px] font-bold bg-[#0d3d3b] text-white px-1.5 py-0.5 rounded">
                            {item.certType}{item.certDetail ? `  ${item.certDetail}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-stone-700">{fmtNum(item.tons)}</td>
                      <td className="px-4 py-3 text-center text-stone-500">{item.unit}</td>
                      <td className="px-4 py-3 text-right text-stone-600">{fmtUsd(item.pricePerTon)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#0d9488]">{fmtUsd(lineTotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[#0d3d3b]/5 border-t border-stone-200">
                  <td colSpan={4} className="px-4 py-3 text-right text-xs font-semibold text-stone-500 uppercase tracking-wide">
                    Grand Total ({proposal.items.length} item{proposal.items.length !== 1 ? "s" : ""})
                  </td>
                  <td className="px-4 py-3 text-right" />
                  <td className="px-4 py-3 text-right text-base font-bold text-[#0d3d3b]">{fmtUsd(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Notes */}
        {proposal.notes && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-stone-700 mb-3">Notes & Terms</h2>
            <p className="text-sm text-stone-600 whitespace-pre-wrap leading-relaxed">{proposal.notes}</p>
          </div>
        )}

        {/* Delete */}
        <div className="flex items-center gap-3">
          {delConfirm ? (
            <>
              <span className="text-sm text-red-500">Are you sure?</span>
              <button onClick={handleDelete} disabled={pending}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50">
                {pending ? "Deleting…" : "Yes, delete"}
              </button>
              <button onClick={() => setDelConfirm(false)} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
            </>
          ) : (
            <button onClick={() => setDelConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-medium rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      </div>
    </>
  );
}
