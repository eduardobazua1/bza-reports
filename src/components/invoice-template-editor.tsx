"use client";

import { useState } from "react";

type InvoiceSettings = {
  companyName: string;
  address1: string;
  address2: string;
  phone: string;
  email: string;
  website: string;
  taxId: string;
  primaryColor: string;
  accentColor: string;
  bankName: string;
  bankAddress: string;
  bankBeneficiary: string;
  bankAccount: string;
  bankRouting: string;
  bankSwift: string;
  fscCode: string;
  fscCw: string;
  fscExpiration: string;
  footerNote: string;
  showPaymentInstructions: boolean;
  showFscSection: boolean;
  invoiceNotes: string;
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

export function InvoiceTemplateEditor({ initial }: { initial?: Partial<InvoiceSettings> | null }) {
  const [cfg, setCfg] = useState<InvoiceSettings>({ ...DEFAULTS, ...(initial || {}) });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
  }

  function Field({ label, field, type = "text", placeholder }: {
    label: string;
    field: keyof InvoiceSettings;
    type?: string;
    placeholder?: string;
  }) {
    return (
      <div>
        <label className="block text-xs text-stone-500 mb-1">{label}</label>
        <input
          type={type}
          className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
          value={cfg[field] as string}
          placeholder={placeholder}
          onChange={e => set(field, e.target.value)}
        />
      </div>
    );
  }

  function Toggle({ label, field }: { label: string; field: keyof InvoiceSettings }) {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={cfg[field] as boolean}
          onChange={e => set(field, e.target.checked)}
          className="rounded"
        />
        <span className="text-sm">{label}</span>
      </label>
    );
  }

  return (
    <div className="bg-white rounded-md shadow-sm">
      <div className="p-4 border-b border-stone-200 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-stone-800">Invoice & PO Template</h3>
          <p className="text-xs text-stone-400 mt-0.5">Customize company info, colors, and sections shown on all PDFs</p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-emerald-600 font-medium">Saved ✓</span>}
          <a
            href="/api/invoice-pdf?invoice=OC-001-001"
            target="_blank"
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Preview PDF ↗
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs bg-[#0d3d3b] text-white px-3 py-1.5 rounded hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Colors */}
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Colors</h4>
          <div className="flex gap-6">
            <div>
              <label className="block text-xs text-stone-500 mb-1">Primary Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cfg.primaryColor}
                  onChange={e => set("primaryColor", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-stone-200"
                />
                <input
                  type="text"
                  value={cfg.primaryColor}
                  onChange={e => set("primaryColor", e.target.value)}
                  className="w-24 border border-stone-200 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-stone-500 mb-1">Accent Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={cfg.accentColor}
                  onChange={e => set("accentColor", e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-stone-200"
                />
                <input
                  type="text"
                  value={cfg.accentColor}
                  onChange={e => set("accentColor", e.target.value)}
                  className="w-24 border border-stone-200 rounded px-2 py-1 text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => { set("primaryColor", "#0d3d3b"); set("accentColor", "#4fd1c5"); }}
                className="text-xs text-stone-400 hover:text-stone-600 pb-1"
              >
                Reset to BZA colors
              </button>
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Company</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Company Name" field="companyName" />
            <Field label="Tax ID" field="taxId" />
            <Field label="Address Line 1" field="address1" />
            <Field label="Address Line 2" field="address2" />
            <Field label="Phone" field="phone" />
            <Field label="Email" field="email" />
            <Field label="Website" field="website" />
          </div>
        </div>

        {/* Bank / Payment */}
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Bank / Payment Instructions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Bank Name" field="bankName" />
            <Field label="Beneficiary" field="bankBeneficiary" />
            <Field label="Bank Address" field="bankAddress" />
            <Field label="Account #" field="bankAccount" />
            <Field label="Routing #" field="bankRouting" />
            <Field label="SWIFT / BIC" field="bankSwift" />
          </div>
        </div>

        {/* FSC */}
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">FSC Certificate (BZA)</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Certificate Code" field="fscCode" placeholder="CU-COC-000000" />
            <Field label="Controlled Wood Code" field="fscCw" placeholder="CU-CW-000000" />
            <Field label="Expiration Date" field="fscExpiration" placeholder="DD-MM-YY" />
          </div>
        </div>

        {/* Footer & Notes */}
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Footer & Notes</h4>
          <div className="space-y-3">
            <Field label="Footer Note" field="footerNote" />
            <div>
              <label className="block text-xs text-stone-500 mb-1">Additional Notes (shown at bottom of invoice)</label>
              <textarea
                className="w-full border border-stone-200 rounded px-2 py-1.5 text-sm"
                rows={3}
                value={cfg.invoiceNotes}
                onChange={e => set("invoiceNotes", e.target.value)}
                placeholder="Any additional terms, notes, or disclaimers..."
              />
            </div>
          </div>
        </div>

        {/* Section Toggles */}
        <div>
          <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Sections</h4>
          <div className="space-y-2">
            <Toggle label="Show payment instructions (bank details)" field="showPaymentInstructions" />
            <Toggle label="Show FSC certificate information" field="showFscSection" />
          </div>
        </div>
      </div>
    </div>
  );
}
