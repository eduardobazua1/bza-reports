"use client";

import { useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
type Settings = {
  // Company
  companyName: string;
  address1: string;
  address2: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  currency: string;
  defaultPaymentTerms: number;
  invoicePrefix: string;
  // Invoice design
  primaryColor: string;
  accentColor: string;
  logoText: string;
  // Invoice fields (reference row)
  showPoField: boolean;
  showBolField: boolean;
  showTrackingField: boolean;
  showDestinationField: boolean;
  showShipDateField: boolean;
  // Sections
  showPaymentInstructions: boolean;
  showFscSection: boolean;
  // Banking
  bankName: string;
  bankAddress: string;
  bankBeneficiary: string;
  bankAccount: string;
  bankRouting: string;
  bankSwift: string;
  // FSC
  fscCode: string;
  fscCw: string;
  fscExpiration: string;
  // Footer
  footerNote: string;
  invoiceNotes: string;
};

const DEFAULTS: Settings = {
  companyName: "BZA International Services, LLC",
  address1: "1209 S. 10th St. Suite A #583",
  address2: "McAllen, TX 78501 US",
  phone: "+15203317869",
  email: "accounting@bza-is.com",
  website: "www.bza-is.com",
  taxId: "32-0655438",
  currency: "USD",
  defaultPaymentTerms: 60,
  invoicePrefix: "IX",
  primaryColor: "#0d3d3b",
  accentColor: "#4fd1c5",
  logoText: "BZA",
  showPoField: true,
  showBolField: true,
  showTrackingField: true,
  showDestinationField: true,
  showShipDateField: true,
  showPaymentInstructions: true,
  showFscSection: true,
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
  invoiceNotes: "",
};

type UserRow = { id: number; email: string; name: string | null; role: string; isActive: boolean; createdAt: string };

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NAV = [
  {
    group: "General",
    items: [
      { id: "company",      label: "Company Profile",  desc: "Legal info, address, billing defaults" },
    ],
  },
  {
    group: "Documents",
    items: [
      { id: "invoice",      label: "Invoice Template", desc: "Design, fields, logo, colors, sections" },
    ],
  },
  {
    group: "System",
    items: [
      { id: "users",        label: "Users & Access",   desc: "Manage team members" },
      { id: "integrations", label: "Integrations",     desc: "Email, AI assistant" },
    ],
  },
];

// ─── Panel ───────────────────────────────────────────────────────────────────
export function SettingsPanel({
  initial, users, isAdmin,
}: {
  initial?: Partial<Settings> | null;
  users: UserRow[];
  isAdmin: boolean;
}) {
  const [active, setActive] = useState("company");
  const [cfg, setCfg]       = useState<Settings>({ ...DEFAULTS, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  function set(field: keyof Settings, value: string | boolean | number) {
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
  const showSave   = ["company", "invoice"].includes(active);

  return (
    <div className="flex gap-0 bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden min-h-[640px]">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-stone-50 border-r border-stone-200 p-3 flex flex-col gap-5">
        {NAV.map(group => (
          <div key={group.group}>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-2 mb-1.5">
              {group.group}
            </p>
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`w-full px-2.5 py-2 rounded-lg text-left text-sm transition-all ${
                  active === item.id
                    ? "bg-[#0d3d3b] text-white font-medium shadow-sm"
                    : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      {/* Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div>
            <h2 className="font-semibold text-stone-800">{activeItem?.label}</h2>
            <p className="text-xs text-stone-400 mt-0.5">{activeItem?.desc}</p>
          </div>
          {showSave && (
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
              )}
              {active === "invoice" && (
                <a
                  href="/api/invoice-pdf?invoice=IX0001-1"
                  target="_blank"
                  className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded px-2.5 py-1.5 transition-colors"
                >
                  Preview PDF ↗
                </a>
              )}
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {active === "company"      && <SectionCompany     cfg={cfg} set={set} />}
          {active === "invoice"      && <SectionInvoice     cfg={cfg} set={set} />}
          {active === "users"        && <SectionUsers       users={users} isAdmin={isAdmin} />}
          {active === "integrations" && <SectionIntegrations />}
        </div>
      </main>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2.5">{title}</h3>
      <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, hint, half,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string; half?: boolean;
}) {
  return (
    <div className={half ? "col-span-1" : ""}>
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

function Toggle({
  label, checked, onChange, hint,
}: {
  label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 shrink-0">
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

// ─── Company Profile ──────────────────────────────────────────────────────────
function SectionCompany({ cfg, set }: { cfg: Settings; set: (f: keyof Settings, v: string | boolean | number) => void }) {
  return (
    <>
      <Card title="Legal Entity">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Field label="Company Name" value={cfg.companyName} onChange={v => set("companyName", v)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Tax ID / EIN" value={cfg.taxId} onChange={v => set("taxId", v)} placeholder="XX-XXXXXXX" />
          </div>
        </div>
      </Card>

      <Card title="Address">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Field label="Address Line 1" value={cfg.address1} onChange={v => set("address1", v)} placeholder="Street, Suite" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Address Line 2" value={cfg.address2} onChange={v => set("address2", v)} placeholder="City, State ZIP Country" />
          </div>
        </div>
      </Card>

      <Card title="Contact">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Field label="Phone"   value={cfg.phone}   onChange={v => set("phone", v)}   placeholder="+1 000 000 0000" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Email"   value={cfg.email}   onChange={v => set("email", v)}   type="email" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Website" value={cfg.website} onChange={v => set("website", v)} placeholder="www.example.com" />
          </div>
        </div>
      </Card>

      <Card title="Billing Defaults">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-stone-500 mb-1">Default Payment Terms (days)</label>
            <input
              type="number"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
              value={cfg.defaultPaymentTerms}
              onChange={e => set("defaultPaymentTerms", Number(e.target.value))}
              placeholder="60"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-stone-500 mb-1">Currency</label>
            <select
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
              value={cfg.currency}
              onChange={e => set("currency", e.target.value)}
            >
              <option value="USD">USD — US Dollar</option>
              <option value="MXN">MXN — Mexican Peso</option>
              <option value="EUR">EUR — Euro</option>
              <option value="CAD">CAD — Canadian Dollar</option>
            </select>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field
              label="Invoice Number Prefix"
              value={cfg.invoicePrefix}
              onChange={v => set("invoicePrefix", v)}
              placeholder="IX"
              hint="e.g. IX → IX0001-1, OC → OC0001-1"
            />
          </div>
        </div>
      </Card>
    </>
  );
}

// ─── Invoice Template ─────────────────────────────────────────────────────────
function SectionInvoice({ cfg, set }: { cfg: Settings; set: (f: keyof Settings, v: string | boolean | number) => void }) {
  return (
    <>
      {/* Design */}
      <Card title="Design">
        <div>
          <p className="text-xs text-stone-500 mb-3">Logo text (displayed on PDF header)</p>
          <div className="flex items-center gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1">Logo Text</label>
              <input
                type="text"
                className="w-28 border border-stone-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
                value={cfg.logoText}
                onChange={e => set("logoText", e.target.value)}
                maxLength={6}
                placeholder="BZA"
              />
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-1">Preview</p>
              <div className="flex items-baseline gap-0.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-xl font-bold" style={{ color: cfg.primaryColor }}>{cfg.logoText || "BZA"}</span>
                <span className="text-xl font-bold" style={{ color: cfg.accentColor }}>.</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 items-end">
            {(["primaryColor", "accentColor"] as const).map(field => (
              <div key={field}>
                <label className="block text-xs font-medium text-stone-500 mb-1.5">
                  {field === "primaryColor" ? "Primary Color" : "Accent Color"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cfg[field]}
                    onChange={e => set(field, e.target.value)}
                    className="w-9 h-9 rounded-lg cursor-pointer border border-stone-200 p-0.5"
                  />
                  <input
                    type="text"
                    value={cfg[field]}
                    onChange={e => set(field, e.target.value)}
                    className="w-24 border border-stone-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
                  />
                  <div className="w-7 h-7 rounded border border-stone-200" style={{ background: cfg[field] }} />
                </div>
              </div>
            ))}
            <button
              onClick={() => { set("primaryColor", "#0d3d3b"); set("accentColor", "#4fd1c5"); }}
              className="text-xs text-stone-500 hover:text-[#0d3d3b] border border-stone-200 rounded-lg px-3 py-2 transition-colors"
            >
              ↺ Reset to BZA defaults
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-semibold" style={{ background: cfg.primaryColor }}>
              Header / background
            </div>
            <div className="h-7 rounded-lg flex items-center justify-center text-white text-[11px] font-semibold" style={{ background: cfg.accentColor }}>
              Accents / highlights
            </div>
          </div>
        </div>
      </Card>

      {/* Fields */}
      <Card title="Reference Fields (shown below addresses)">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Toggle label="Purchase Order #"   checked={cfg.showPoField}          onChange={v => set("showPoField", v)} />
          <Toggle label="BOL / Bill of Lading" checked={cfg.showBolField}       onChange={v => set("showBolField", v)} />
          <Toggle label="Tracking / Vehicle"  checked={cfg.showTrackingField}   onChange={v => set("showTrackingField", v)} />
          <Toggle label="Destination"         checked={cfg.showDestinationField} onChange={v => set("showDestinationField", v)} />
          <Toggle label="Ship Date"           checked={cfg.showShipDateField}   onChange={v => set("showShipDateField", v)} />
        </div>
      </Card>

      {/* Sections */}
      <Card title="Optional Sections">
        <Toggle
          label="Payment Instructions"
          hint="Includes bank details at the bottom of every invoice"
          checked={cfg.showPaymentInstructions}
          onChange={v => set("showPaymentInstructions", v)}
        />
        <Toggle
          label="FSC Certificate"
          hint="Prints BZA's FSC codes below the payment block"
          checked={cfg.showFscSection}
          onChange={v => set("showFscSection", v)}
        />
      </Card>

      {/* Banking */}
      <Card title="Banking / Payment Details">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Field label="Bank Name"    value={cfg.bankName}        onChange={v => set("bankName", v)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Beneficiary"  value={cfg.bankBeneficiary} onChange={v => set("bankBeneficiary", v)} />
          </div>
          <div className="col-span-2">
            <Field label="Bank Address" value={cfg.bankAddress}     onChange={v => set("bankAddress", v)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Account #"    value={cfg.bankAccount}     onChange={v => set("bankAccount", v)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Routing #"    value={cfg.bankRouting}     onChange={v => set("bankRouting", v)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="SWIFT / BIC"  value={cfg.bankSwift}       onChange={v => set("bankSwift", v)} />
          </div>
        </div>
      </Card>

      {/* FSC */}
      <Card title="FSC Certificate (BZA)">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <Field label="COC Code"             value={cfg.fscCode}       onChange={v => set("fscCode", v)}       placeholder="CU-COC-000000" />
          </div>
          <div>
            <Field label="Controlled Wood Code" value={cfg.fscCw}         onChange={v => set("fscCw", v)}         placeholder="CU-CW-000000" />
          </div>
          <div>
            <Field label="Expiration"           value={cfg.fscExpiration} onChange={v => set("fscExpiration", v)} placeholder="DD-MM-YY" />
          </div>
        </div>
      </Card>

      {/* Footer */}
      <Card title="Footer & Notes">
        <Field
          label="Footer Note"
          value={cfg.footerNote}
          onChange={v => set("footerNote", v)}
          placeholder="e.g. All invoice amounts are stated in USD."
        />
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Additional Notes <span className="font-normal text-stone-400">(bottom of invoice)</span>
          </label>
          <textarea
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
            rows={3}
            value={cfg.invoiceNotes}
            onChange={e => set("invoiceNotes", e.target.value)}
            placeholder="Additional terms, conditions, or disclaimers…"
          />
        </div>
      </Card>
    </>
  );
}

// ─── Users ────────────────────────────────────────────────────────────────────
function SectionUsers({ users, isAdmin }: { users: UserRow[]; isAdmin: boolean }) {
  return (
    <>
      <Card title="Team Members">
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
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-[#0d3d3b]/10 text-[#0d3d3b]" : "bg-stone-100 text-stone-500"}`}>
                  {u.role}
                </span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>
                  {u.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {isAdmin && (
        <p className="text-xs text-stone-400">To add or remove users, edit the database directly or contact your system administrator.</p>
      )}
    </>
  );
}

// ─── Integrations ─────────────────────────────────────────────────────────────
function SectionIntegrations() {
  return (
    <>
      <Card title="Email (SMTP)">
        <div className="grid grid-cols-2 gap-4">
          <div><Field label="SMTP Host"     value="" onChange={() => {}} placeholder="mail.ionos.com" hint="Set via SMTP_HOST in Vercel env vars" /></div>
          <div><Field label="SMTP Port"     value="" onChange={() => {}} placeholder="587" /></div>
          <div><Field label="SMTP User"     value="" onChange={() => {}} placeholder="no-reply@bza-is.com" hint="Set via SMTP_USER in Vercel env vars" /></div>
          <div><Field label="SMTP Password" value="" onChange={() => {}} type="password" placeholder="••••••••" hint="Set via SMTP_PASS in Vercel env vars" /></div>
        </div>
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          SMTP credentials must be set as environment variables in Vercel → Project → Settings → Environment Variables.
        </div>
      </Card>
      <Card title="AI Assistant (OpenAI)">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <Field label="OpenAI API Key" value="" onChange={() => {}} type="password" placeholder="sk-…" hint="Set via OPENAI_API_KEY in Vercel env vars" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Field label="Model" value="" onChange={() => {}} placeholder="gpt-4o-mini" />
          </div>
        </div>
        <p className="text-xs text-stone-400">Requires a funded OpenAI account. Add at least $5 credit at platform.openai.com.</p>
      </Card>
    </>
  );
}
