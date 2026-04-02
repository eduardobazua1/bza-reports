"use client";

import { useState } from "react";

// ─── Field definition ────────────────────────────────────────────────────────
export type InvoiceField = {
  id: string;
  key: string;       // data key ("date" | "dueDate" | "terms" | "shipVia" | "po" | "bol" | "tracking" | "destination" | "shipDate" | "custom")
  label: string;     // column header on PDF
  section: "meta" | "reference"; // where it appears on the invoice
  enabled: boolean;
  isDefault: boolean;
  staticValue?: string; // only for custom fields
};

const DEFAULT_FIELDS: InvoiceField[] = [
  { id: "date",        key: "date",        label: "Date",            section: "meta",      enabled: true,  isDefault: true },
  { id: "dueDate",     key: "dueDate",     label: "Due Date",        section: "meta",      enabled: true,  isDefault: true },
  { id: "terms",       key: "terms",       label: "Terms",           section: "meta",      enabled: true,  isDefault: true },
  { id: "shipVia",     key: "shipVia",     label: "Ship Via",        section: "meta",      enabled: true,  isDefault: true },
  { id: "po",          key: "po",          label: "Purchase Order",  section: "reference", enabled: true,  isDefault: true },
  { id: "bol",         key: "bol",         label: "BOL #",           section: "reference", enabled: true,  isDefault: true },
  { id: "tracking",    key: "tracking",    label: "Tracking #",      section: "reference", enabled: true,  isDefault: true },
  { id: "destination", key: "destination", label: "Destination",     section: "reference", enabled: true,  isDefault: true },
  { id: "shipDate",    key: "shipDate",    label: "Ship Date",       section: "reference", enabled: true,  isDefault: true },
];

// ─── Settings type ────────────────────────────────────────────────────────────
type Settings = {
  companyName: string; address1: string; address2: string;
  phone: string; email: string; website: string; taxId: string;
  currency: string; defaultPaymentTerms: number; invoicePrefix: string;
  primaryColor: string; accentColor: string; logoText: string;
  invoiceFields: InvoiceField[];
  showPaymentInstructions: boolean; showFscSection: boolean;
  bankName: string; bankAddress: string; bankBeneficiary: string;
  bankAccount: string; bankRouting: string; bankSwift: string;
  fscCode: string; fscCw: string; fscExpiration: string;
  footerNote: string; invoiceNotes: string;
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
  invoiceFields: DEFAULT_FIELDS,
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

const NAV = [
  { group: "General",   items: [{ id: "company",      label: "Company Profile",  desc: "Legal info, address, billing defaults" }] },
  { group: "Documents", items: [{ id: "invoice",      label: "Invoice Template", desc: "Design, fields, colors, sections" }] },
  { group: "System",    items: [
    { id: "users",        label: "Users & Access",   desc: "Manage team members" },
    { id: "integrations", label: "Integrations",     desc: "Email, AI assistant" },
  ]},
];

// ─── Panel ───────────────────────────────────────────────────────────────────
export function SettingsPanel({ initial, users, isAdmin }: {
  initial?: Partial<Settings> | null;
  users: UserRow[];
  isAdmin: boolean;
}) {
  const [active, setActive] = useState("company");
  const [cfg, setCfg] = useState<Settings>({
    ...DEFAULTS,
    ...(initial || {}),
    invoiceFields: (initial as Settings)?.invoiceFields?.length
      ? (initial as Settings).invoiceFields
      : DEFAULT_FIELDS,
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  function set(field: keyof Settings, value: unknown) {
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
    <div className="flex bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden min-h-[640px]">
      <aside className="w-52 shrink-0 bg-stone-50 border-r border-stone-200 p-3 flex flex-col gap-5">
        {NAV.map(group => (
          <div key={group.group}>
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest px-2 mb-1.5">{group.group}</p>
            {group.items.map(item => (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className={`w-full px-2.5 py-2 rounded-lg text-left text-sm transition-all ${
                  active === item.id ? "bg-[#0d3d3b] text-white font-medium shadow-sm" : "text-stone-600 hover:bg-stone-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div>
            <h2 className="font-semibold text-stone-800">{activeItem?.label}</h2>
            <p className="text-xs text-stone-400 mt-0.5">{activeItem?.desc}</p>
          </div>
          {["company","invoice"].includes(active) && (
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
                <a href="/api/invoice-pdf?invoice=IX0001-1" target="_blank"
                  className="text-xs text-stone-400 hover:text-stone-600 border border-stone-200 rounded px-2.5 py-1.5">
                  Preview PDF ↗
                </a>
              )}
              <button onClick={handleSave} disabled={saving}
                className="text-xs bg-[#0d3d3b] text-white px-3.5 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-50 font-medium">
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2.5">{title}</h3>
      <div className="bg-stone-50 rounded-xl p-4 border border-stone-100 space-y-4">{children}</div>
    </div>
  );
}

function TF({ label, value, onChange, type = "text", placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-stone-500 mb-1">{label}</label>
      <input type={type}
        className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40 focus:border-[#4fd1c5]"
        value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      {hint && <p className="text-[11px] text-stone-400 mt-1">{hint}</p>}
    </div>
  );
}

function Sw({ label, checked, onChange, hint }: {
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

// ─── Field Manager ────────────────────────────────────────────────────────────
function FieldManager({ fields, onChange }: {
  fields: InvoiceField[];
  onChange: (fields: InvoiceField[]) => void;
}) {
  function updateField(id: string, patch: Partial<InvoiceField>) {
    onChange(fields.map(f => f.id === id ? { ...f, ...patch } : f));
  }
  function removeField(id: string) {
    onChange(fields.filter(f => f.id !== id));
  }
  function addField(section: "meta" | "reference", label: string, staticValue: string) {
    if (!label.trim()) return;
    onChange([...fields, {
      id: `custom_${Date.now()}`,
      key: "custom",
      label: label.trim(),
      section,
      enabled: true,
      isDefault: false,
      staticValue: staticValue.trim(),
    }]);
  }

  function FieldRow({ f }: { f: InvoiceField }) {
    return (
      <div className={`flex items-center gap-2 py-2 px-3 rounded-lg border ${f.enabled ? "border-stone-200 bg-white" : "border-stone-100 bg-stone-50 opacity-55"}`}>
        <button
          onClick={() => updateField(f.id, { enabled: !f.enabled })}
          className={`w-8 h-5 rounded-full transition-colors shrink-0 relative ${f.enabled ? "bg-[#0d3d3b]" : "bg-stone-300"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${f.enabled ? "translate-x-3" : ""}`} />
        </button>
        <input
          className="flex-1 min-w-0 text-sm border border-transparent rounded px-1.5 py-0.5 focus:border-stone-300 focus:outline-none bg-transparent hover:bg-stone-100 transition-colors"
          value={f.label}
          onChange={e => updateField(f.id, { label: e.target.value })}
        />
        {f.key === "custom" && (
          <input
            className="w-24 text-xs border border-stone-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#4fd1c5]/40 text-stone-500"
            value={f.staticValue || ""}
            placeholder="Value…"
            onChange={e => updateField(f.id, { staticValue: e.target.value })}
          />
        )}
        {!f.isDefault ? (
          <button onClick={() => removeField(f.id)}
            className="w-6 h-6 flex items-center justify-center rounded text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0 text-base leading-none"
            title="Remove">×</button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
      </div>
    );
  }

  function AddRow({ section }: { section: "meta" | "reference" }) {
    const [open, setOpen]   = useState(false);
    const [label, setLabel] = useState("");
    const [val, setVal]     = useState("");

    function commit() {
      if (!label.trim()) return;
      addField(section, label, val);
      setLabel(""); setVal(""); setOpen(false);
    }

    return open ? (
      <div className="flex items-center gap-2 mt-1.5 pl-1">
        <input autoFocus
          className="flex-1 border border-[#4fd1c5] rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
          placeholder="Field label…"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setOpen(false); }}
        />
        <input
          className="w-28 border border-stone-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#4fd1c5]/40 text-stone-500"
          placeholder="Value (opt.)"
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(); }}
        />
        <button onClick={commit} disabled={!label.trim()}
          className="text-xs bg-[#0d3d3b] text-white px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-40 font-medium">
          Add
        </button>
        <button onClick={() => { setOpen(false); setLabel(""); setVal(""); }}
          className="text-xs text-stone-400 hover:text-stone-600 px-2 py-1.5">
          Cancel
        </button>
      </div>
    ) : (
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-400 hover:text-[#0d3d3b] hover:bg-stone-100 px-2.5 py-1.5 rounded-lg transition-colors w-full"
      >
        <span className="text-base leading-none font-light">+</span> Add field
      </button>
    );
  }

  const metaFields = fields.filter(f => f.section === "meta");
  const refFields  = fields.filter(f => f.section === "reference");

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
          Header strip <span className="font-normal normal-case text-stone-400">— top row (date, terms…)</span>
        </p>
        <div className="space-y-1.5">
          {metaFields.map(f => <FieldRow key={f.id} f={f} />)}
          {metaFields.length === 0 && <p className="text-xs text-stone-400 italic pl-1 py-1">Empty</p>}
        </div>
        <AddRow section="meta" />
      </div>

      <div>
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
          Reference row <span className="font-normal normal-case text-stone-400">— below addresses (PO#, BOL…)</span>
        </p>
        <div className="space-y-1.5">
          {refFields.map(f => <FieldRow key={f.id} f={f} />)}
          {refFields.length === 0 && <p className="text-xs text-stone-400 italic pl-1 py-1">Empty</p>}
        </div>
        <AddRow section="reference" />
      </div>
    </div>
  );
}

// ─── Company ──────────────────────────────────────────────────────────────────
function SectionCompany({ cfg, set }: { cfg: Settings; set: (f: keyof Settings, v: unknown) => void }) {
  return (
    <>
      <Card title="Legal Entity">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1"><TF label="Company Name" value={cfg.companyName} onChange={v => set("companyName", v)} /></div>
          <div className="col-span-2 sm:col-span-1"><TF label="Tax ID / EIN" value={cfg.taxId} onChange={v => set("taxId", v)} placeholder="XX-XXXXXXX" /></div>
        </div>
      </Card>
      <Card title="Address">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1"><TF label="Address Line 1" value={cfg.address1} onChange={v => set("address1", v)} /></div>
          <div className="col-span-2 sm:col-span-1"><TF label="Address Line 2" value={cfg.address2} onChange={v => set("address2", v)} /></div>
        </div>
      </Card>
      <Card title="Contact">
        <div className="grid grid-cols-3 gap-4">
          <TF label="Phone"   value={cfg.phone}   onChange={v => set("phone", v)} />
          <TF label="Email"   value={cfg.email}   onChange={v => set("email", v)} type="email" />
          <TF label="Website" value={cfg.website} onChange={v => set("website", v)} />
        </div>
      </Card>
      <Card title="Billing Defaults">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Default Payment Terms (days)</label>
            <input type="number"
              className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
              value={cfg.defaultPaymentTerms} onChange={e => set("defaultPaymentTerms", Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Currency</label>
            <select className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40 bg-white"
              value={cfg.currency} onChange={e => set("currency", e.target.value)}>
              <option value="USD">USD — US Dollar</option>
              <option value="MXN">MXN — Mexican Peso</option>
              <option value="EUR">EUR — Euro</option>
              <option value="CAD">CAD — Canadian Dollar</option>
            </select>
          </div>
          <TF label="Invoice Number Prefix" value={cfg.invoicePrefix} onChange={v => set("invoicePrefix", v)}
            placeholder="IX" hint="e.g. IX → IX0001-1" />
        </div>
      </Card>
    </>
  );
}

// ─── Invoice Template ─────────────────────────────────────────────────────────
function SectionInvoice({ cfg, set }: { cfg: Settings; set: (f: keyof Settings, v: unknown) => void }) {
  return (
    <>
      <Card title="Design">
        <div className="flex items-start gap-8 flex-wrap">
          {/* Logo text */}
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1">Logo Text</label>
            <div className="flex items-center gap-3">
              <input type="text" maxLength={6}
                className="w-24 border border-stone-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
                value={cfg.logoText} placeholder="BZA" onChange={e => set("logoText", e.target.value)} />
              <div className="flex items-baseline gap-0 px-3 py-1.5 rounded-lg border border-stone-200 bg-white">
                <span className="text-xl font-bold" style={{ color: cfg.primaryColor }}>{cfg.logoText || "BZA"}</span>
                <span className="text-xl font-bold" style={{ color: cfg.accentColor }}>.</span>
              </div>
            </div>
          </div>
          {/* Colors */}
          {(["primaryColor","accentColor"] as const).map(field => (
            <div key={field}>
              <label className="block text-xs font-medium text-stone-500 mb-1">
                {field === "primaryColor" ? "Primary" : "Accent"}
              </label>
              <div className="flex items-center gap-2">
                <input type="color" value={cfg[field]}
                  onChange={e => set(field, e.target.value)}
                  className="w-9 h-9 rounded-lg cursor-pointer border border-stone-200 p-0.5" />
                <input type="text" value={cfg[field]}
                  onChange={e => set(field, e.target.value)}
                  className="w-24 border border-stone-200 rounded-lg px-2 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40" />
                <div className="w-7 h-7 rounded border border-stone-200" style={{ background: cfg[field] }} />
              </div>
            </div>
          ))}
          <div className="flex items-end">
            <button onClick={() => { set("primaryColor", "#0d3d3b"); set("accentColor", "#4fd1c5"); }}
              className="text-xs text-stone-500 hover:text-[#0d3d3b] border border-stone-200 rounded-lg px-3 py-2 transition-colors">
              ↺ BZA defaults
            </button>
          </div>
        </div>
      </Card>

      <Card title="Fields & Layout">
        <p className="text-xs text-stone-400 -mt-2 mb-1">
          Toggle, rename, reposition, or add custom fields. The label shown is the column header on the PDF.
        </p>
        <FieldManager
          fields={cfg.invoiceFields}
          onChange={fields => set("invoiceFields", fields)}
        />
      </Card>

      <Card title="Optional Sections">
        <Sw label="Payment Instructions" hint="Bank details at the bottom of the invoice"
          checked={cfg.showPaymentInstructions} onChange={v => set("showPaymentInstructions", v)} />
        <Sw label="FSC Certificate" hint="BZA FSC codes printed on the invoice"
          checked={cfg.showFscSection} onChange={v => set("showFscSection", v)} />
      </Card>

      <Card title="Banking / Payment Details">
        <div className="grid grid-cols-2 gap-4">
          <TF label="Bank Name"    value={cfg.bankName}        onChange={v => set("bankName", v)} />
          <TF label="Beneficiary"  value={cfg.bankBeneficiary} onChange={v => set("bankBeneficiary", v)} />
          <div className="col-span-2"><TF label="Bank Address" value={cfg.bankAddress} onChange={v => set("bankAddress", v)} /></div>
          <TF label="Account #"   value={cfg.bankAccount}     onChange={v => set("bankAccount", v)} />
          <TF label="Routing #"   value={cfg.bankRouting}     onChange={v => set("bankRouting", v)} />
          <TF label="SWIFT / BIC" value={cfg.bankSwift}       onChange={v => set("bankSwift", v)} />
        </div>
      </Card>

      <Card title="FSC Certificate (BZA)">
        <div className="grid grid-cols-3 gap-4">
          <TF label="COC Code"             value={cfg.fscCode}       onChange={v => set("fscCode", v)}       placeholder="CU-COC-000000" />
          <TF label="Controlled Wood Code" value={cfg.fscCw}         onChange={v => set("fscCw", v)}         placeholder="CU-CW-000000" />
          <TF label="Expiration"           value={cfg.fscExpiration} onChange={v => set("fscExpiration", v)} placeholder="DD-MM-YY" />
        </div>
      </Card>

      <Card title="Footer & Notes">
        <TF label="Footer Note" value={cfg.footerNote} onChange={v => set("footerNote", v)}
          placeholder="e.g. All invoice amounts are stated in USD." />
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1">
            Additional Notes <span className="font-normal text-stone-400">(bottom of invoice)</span>
          </label>
          <textarea
            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4fd1c5]/40"
            rows={3} value={cfg.invoiceNotes}
            onChange={e => set("invoiceNotes", e.target.value)}
            placeholder="Additional terms, conditions, or disclaimers…" />
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
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-[#0d3d3b]/10 text-[#0d3d3b]" : "bg-stone-100 text-stone-500"}`}>{u.role}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded-full ${u.isActive ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"}`}>{u.isActive ? "Active" : "Inactive"}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {isAdmin && <p className="text-xs text-stone-400">To add or remove users, edit the database directly or contact your system administrator.</p>}
    </>
  );
}

// ─── Integrations ─────────────────────────────────────────────────────────────
function SectionIntegrations() {
  return (
    <>
      <Card title="Email (SMTP)">
        <div className="grid grid-cols-2 gap-4">
          <TF label="SMTP Host"     value="" onChange={() => {}} placeholder="mail.ionos.com"      hint="Set via SMTP_HOST in Vercel env vars" />
          <TF label="SMTP Port"     value="" onChange={() => {}} placeholder="587" />
          <TF label="SMTP User"     value="" onChange={() => {}} placeholder="no-reply@bza-is.com" hint="Set via SMTP_USER in Vercel env vars" />
          <TF label="SMTP Password" value="" onChange={() => {}} type="password" placeholder="••••••••" hint="Set via SMTP_PASS in Vercel env vars" />
        </div>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
          Credentials must be set as environment variables in Vercel → Project → Settings → Environment Variables.
        </p>
      </Card>
      <Card title="AI Assistant (OpenAI)">
        <div className="grid grid-cols-2 gap-4">
          <TF label="API Key" value="" onChange={() => {}} type="password" placeholder="sk-…" hint="Set via OPENAI_API_KEY in Vercel env vars" />
          <TF label="Model"   value="" onChange={() => {}} placeholder="gpt-4o-mini" />
        </div>
        <p className="text-xs text-stone-400">Requires a funded OpenAI account. Add at least $5 credit at platform.openai.com.</p>
      </Card>
    </>
  );
}
