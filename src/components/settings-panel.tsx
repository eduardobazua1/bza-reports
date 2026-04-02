"use client";

import { useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────────
type InvoiceSettings = {
  companyName: string; address1: string; address2: string;
  phone: string; email: string; website: string; taxId: string;
  primaryColor: string; accentColor: string;
  bankName: string; bankAddress: string; bankBeneficiary: string;
  bankAccount: string; bankRouting: string; bankSwift: string;
  fscCode: string; fscCw: string; fscExpiration: string;
  footerNote: string; showPaymentInstructions: boolean;
  showFscSection: boolean; invoiceNotes: string;
};

const DEFAULTS: InvoiceSettings = {
  companyName: "BZA International Services, LLC",
  address1: "1209 S. 10th St. Suite A #583",
  address2: "McAllen, TX 78501 US",
  phone: "+15203317869",
  email: "accounting@bza-is.com",
  website: "www.bza-is.com",
  taxId: "32-0655438",
  primaryColor: "#0d3d3b",
  accentColor: "#4fd1c5",
  bankName: "Vantage Bank",
  bankAddress: "1705 N. 23rd St. McAllen, TX 78501",
  bankBeneficiary: "BZA International Services, LLC",
  bankAccount: "107945161",
  bankRouting: "114915272",
  bankSwift: "ITNBUS44",
  fscCode: "CU-COC-892954",
  fscCw: "CU-CW-892954",
  fscExpiration: "29-01-28",
  footerNote: "All invoice amounts are stated in USD.",
  showPaymentInstructions: true,
  showFscSection: true,
  invoiceNotes: "",
};

type UserRow = { id: number; email: string; name: string | null; role: string; isActive: boolean; createdAt: string };

// ─── Nav items ───────────────────────────────────────────────────────────────
const NAV = [
  {
    group: "General",
    items: [
      { id: "company",      label: "Company Profile",    icon: "🏢", desc: "Name, address, tax ID" },
      { id: "appearance",   label: "Appearance",         icon: "🎨", desc: "Brand colors" },
    ],
  },
  {
    group: "Documents",
    items: [
      { id: "invoice",      label: "Invoice Template",   icon: "🧾", desc: "Layout, sections, notes" },
      { id: "banking",      label: "Banking Details",    icon: "🏦", desc: "Payment instructions on PDFs" },
      { id: "fsc",          label: "FSC Certificate",    icon: "🌲", desc: "BZA FSC codes for documents" },
    ],
  },
  {
    group: "System",
    items: [
      { id: "users",        label: "Users & Access",     icon: "👤", desc: "Manage team members" },
      { id: "integrations", label: "Integrations",       icon: "🔌", desc: "Email, AI assistant" },
    ],
  },
];

// ─── Main panel ──────────────────────────────────────────────────────────────
export function SettingsPanel({
  initial,
  users,
  isAdmin,
}: {
  initial?: Partial<InvoiceSettings> | null;
  users: UserRow[];
  isAdmin: boolean;
}) {
  const [active, setActive] = useState("company");
  const [cfg, setCfg]       = useState<InvoiceSettings>({ ...DEFAULTS, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  function set(field: keyof InvoiceSettings, value: string | boolean) {
    setCfg(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/settings?key=invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const activeItem = NAV.flatMap(g => g.items).find(i => i.id === active);

  return (
    <div className="flex gap-0 bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden min-h-[600px]">
      {/* ── Sidebar ── */}
      <aside className="w-56 shrink-0 bg-stone-50 border-r border-stone-200 p-3 flex flex-col gap-4">
        {NAV.map(group => (
          <div key={group.group}>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-2 mb-1">
              {group.group}
            </p>
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-all ${
                  active === item.id
                    ? "bg-[#0d3d3b] text-white font-medium shadow-sm"
                    : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* ── Content ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div>
            <h2 className="font-semibold text-stone-800">{activeItem?.label}</h2>
            <p className="text-xs text-stone-400 mt-0.5">{activeItem?.desc}</p>
          </div>
          {["company","appearance","invoice","banking","fsc"].includes(active) && (
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              <a
                href="/api/invoice-pdf?invoice=IX0001-1"
                target="_blank"
                className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded px-2.5 py-1.5 transition-colors"
              >
                Preview PDF ↗
              </a>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs bg-[#0d3d3b] text-white px-3.5 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 font-medium"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>

        {/* Section body */}
        <div className="flex-1 overflow-y-auto p-6">
          {active === "company"     && <SectionCompany     cfg={cfg} set={set} />}
          {active === "appearance"  && <SectionAppearance  cfg={cfg} set={set} />}
          {active === "invoice"     && <SectionInvoice     cfg={cfg} set={set} />}
          {active === "banking"     && <SectionBanking     cfg={cfg} set={set} />}
          {active === "fsc"         && <SectionFsc         cfg={cfg} set={set} />}
          {active === "users"       && <SectionUsers       users={users} isAdmin={isAdmin} />}
          {active === "integrations" && <SectionIntegrations />}
        </div>
      </main>
    </div>
  );
}

// ─── Field helpers ───────────────────────────────────────────────────────────
function Field({
  label, value, onChange, type = "text", placeholder, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-500 mb-1">{label}</label>
      <input
        type={type}
        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40 focus:border-[#4fd1c5]"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
      {hint && <p className="text-[11px] text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange, hint }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-9 h-5 rounded-full transition-colors ${checked ? "bg-[#0d3d3b]" : "bg-stone-300"}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? "translate-x-4" : ""}`} />
      </div>
      <div>
        <p className="text-sm text-stone-700">{label}</p>
        {hint && <p className="text-xs text-stone-400">{hint}</p>}
      </div>
    </label>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">{title}</h3>
      <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">{children}</div>
    </div>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────
function SectionCompany({ cfg, set }: { cfg: InvoiceSettings; set: (f: keyof InvoiceSettings, v: string | boolean) => void }) {
  return (
    <div>
      <SectionCard title="Legal Entity">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Company Name"   value={cfg.companyName} onChange={v => set("companyName", v)} />
          <Field label="Tax ID / EIN"   value={cfg.taxId}       onChange={v => set("taxId", v)} placeholder="XX-XXXXXXX" />
        </div>
      </SectionCard>
      <SectionCard title="Address">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Address Line 1" value={cfg.address1} onChange={v => set("address1", v)} />
          <Field label="Address Line 2" value={cfg.address2} onChange={v => set("address2", v)} />
        </div>
      </SectionCard>
      <SectionCard title="Contact">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Phone"   value={cfg.phone}   onChange={v => set("phone", v)} placeholder="+1 000 000 0000" />
          <Field label="Email"   value={cfg.email}   onChange={v => set("email", v)} type="email" />
          <Field label="Website" value={cfg.website} onChange={v => set("website", v)} placeholder="www.example.com" />
        </div>
      </SectionCard>
    </div>
  );
}

function SectionAppearance({ cfg, set }: { cfg: InvoiceSettings; set: (f: keyof InvoiceSettings, v: string | boolean) => void }) {
  return (
    <div>
      <SectionCard title="Brand Colors">
        <div className="flex flex-wrap gap-8 items-end">
          {([
            { label: "Primary Color",  field: "primaryColor" as const },
            { label: "Accent Color",   field: "accentColor"  as const },
          ] as const).map(({ label, field }) => (
            <div key={field}>
              <label className="block text-xs font-medium text-stone-500 mb-2">{label}</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={cfg[field]}
                  onChange={e => set(field, e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border border-stone-200 p-0.5"
                />
                <input
                  type="text"
                  value={cfg[field]}
                  onChange={e => set(field, e.target.value)}
                  className="w-28 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
                />
                <div className="w-8 h-8 rounded-lg border border-stone-200" style={{ background: cfg[field] }} />
              </div>
            </div>
          ))}
          <button
            onClick={() => { set("primaryColor", "#0d3d3b"); set("accentColor", "#4fd1c5"); }}
            className="text-xs text-stone-500 hover:text-[#0d3d3b] border border-stone-200 rounded-lg px-3 py-2 mb-0.5 transition-colors"
          >
            ↺ Reset to BZA defaults
          </button>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="h-8 rounded-lg flex-1 flex items-center justify-center text-white text-xs font-semibold" style={{ background: cfg.primaryColor }}>
            Primary — Headers & background
          </div>
          <div className="h-8 rounded-lg flex-1 flex items-center justify-center text-white text-xs font-semibold" style={{ background: cfg.accentColor }}>
            Accent — Highlights & labels
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function SectionInvoice({ cfg, set }: { cfg: InvoiceSettings; set: (f: keyof InvoiceSettings, v: string | boolean) => void }) {
  return (
    <div>
      <SectionCard title="Sections to show on PDF">
        <div className="space-y-4">
          <Toggle
            label="Payment Instructions"
            hint="Shows bank details at the bottom of the invoice"
            checked={cfg.showPaymentInstructions}
            onChange={v => set("showPaymentInstructions", v)}
          />
          <Toggle
            label="FSC Certificate"
            hint="Shows BZA's FSC certification codes on the invoice"
            checked={cfg.showFscSection}
            onChange={v => set("showFscSection", v)}
          />
        </div>
      </SectionCard>
      <SectionCard title="Footer & Notes">
        <div className="space-y-4">
          <Field
            label="Footer Note"
            value={cfg.footerNote}
            onChange={v => set("footerNote", v)}
            placeholder="e.g. All invoice amounts are stated in USD."
          />
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">
              Additional Notes <span className="font-normal text-stone-400">(shown at bottom of invoice)</span>
            </label>
            <textarea
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40 focus:border-[#4fd1c5]"
              rows={3}
              value={cfg.invoiceNotes}
              onChange={e => set("invoiceNotes", e.target.value)}
              placeholder="Additional terms, conditions, or disclaimers…"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function SectionBanking({ cfg, set }: { cfg: InvoiceSettings; set: (f: keyof InvoiceSettings, v: string | boolean) => void }) {
  return (
    <div>
      <SectionCard title="Bank Account">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Bank Name"       value={cfg.bankName}        onChange={v => set("bankName", v)} />
          <Field label="Beneficiary"     value={cfg.bankBeneficiary} onChange={v => set("bankBeneficiary", v)} />
          <Field label="Bank Address"    value={cfg.bankAddress}     onChange={v => set("bankAddress", v)} />
          <Field label="Account #"       value={cfg.bankAccount}     onChange={v => set("bankAccount", v)} />
          <Field label="Routing #"       value={cfg.bankRouting}     onChange={v => set("bankRouting", v)} />
          <Field label="SWIFT / BIC"     value={cfg.bankSwift}       onChange={v => set("bankSwift", v)} />
        </div>
      </SectionCard>
      <div className="text-xs text-stone-400 bg-amber-50 border border-amber-100 rounded-lg p-3">
        These details appear in the "Payment Instructions" section of every invoice PDF. Make sure they are correct before sending documents to clients.
      </div>
    </div>
  );
}

function SectionFsc({ cfg, set }: { cfg: InvoiceSettings; set: (f: keyof InvoiceSettings, v: string | boolean) => void }) {
  return (
    <div>
      <SectionCard title="BZA FSC Certificate">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="COC Code"             value={cfg.fscCode}       onChange={v => set("fscCode", v)}       placeholder="CU-COC-000000" />
          <Field label="Controlled Wood Code" value={cfg.fscCw}         onChange={v => set("fscCw", v)}         placeholder="CU-CW-000000" />
          <Field label="Expiration Date"      value={cfg.fscExpiration} onChange={v => set("fscExpiration", v)} placeholder="DD-MM-YY" />
        </div>
      </SectionCard>
      <div className="text-xs text-stone-400 bg-stone-50 border border-stone-100 rounded-lg p-3">
        These are BZA's own FSC certification codes, shown on invoice PDFs when the FSC section is enabled. Supplier-specific FSC data is managed on each supplier's detail page.
      </div>
    </div>
  );
}

function SectionUsers({ users, isAdmin }: { users: UserRow[]; isAdmin: boolean }) {
  return (
    <div>
      <SectionCard title="Team Members">
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#0d3d3b]/10 flex items-center justify-center text-sm font-semibold text-[#0d3d3b]">
                  {(u.name || u.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-800">{u.name || "—"}</p>
                  <p className="text-xs text-stone-400">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  u.role === "admin"
                    ? "bg-[#0d3d3b]/10 text-[#0d3d3b]"
                    : "bg-stone-100 text-stone-500"
                }`}>
                  {u.role}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${
                  u.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                }`}>
                  {u.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
      {isAdmin && (
        <div className="text-xs text-stone-400 bg-stone-50 border border-stone-100 rounded-lg p-3">
          To add or remove users, contact your system administrator or use the database directly.
        </div>
      )}
    </div>
  );
}

function SectionIntegrations() {
  return (
    <div className="space-y-4">
      <SectionCard title="Email (SMTP)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <Field label="SMTP Host"     value="" onChange={() => {}} placeholder="mail.ionos.com" hint="Set via SMTP_HOST in .env.local" />
          <Field label="SMTP Port"     value="" onChange={() => {}} placeholder="587" />
          <Field label="SMTP User"     value="" onChange={() => {}} placeholder="no-reply@bza-is.com" hint="Set via SMTP_USER in .env.local" />
          <Field label="SMTP Password" value="" onChange={() => {}} type="password" placeholder="••••••••" hint="Set via SMTP_PASS in .env.local" />
        </div>
        <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
          SMTP credentials must be configured as environment variables in your hosting platform (Vercel → Settings → Environment Variables). Fields above are for reference only.
        </div>
      </SectionCard>
      <SectionCard title="AI Assistant (OpenAI)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
          <Field label="OpenAI API Key" value="" onChange={() => {}} type="password" placeholder="sk-…" hint="Set via OPENAI_API_KEY in .env.local or Vercel env vars" />
          <Field label="Model" value="" onChange={() => {}} placeholder="gpt-4o-mini" hint="Default: gpt-4o-mini" />
        </div>
        <div className="text-xs text-stone-400 bg-stone-50 border border-stone-100 rounded-lg p-3">
          Requires a funded OpenAI account. Add at least $5 credit at platform.openai.com to activate the AI assistant.
        </div>
      </SectionCard>
    </div>
  );
}
