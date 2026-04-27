export default function HelpPage() {
  return (
    <div className="p-6 md:p-10 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Help & Support</h1>
        <p className="text-sm text-stone-400 mt-1">BZA International Services — TMS</p>
      </div>

      <div className="space-y-4">
        <Section title="BZA Intelligence">
          <p>Use the <strong>✦ button</strong> (bottom right) to chat with BZA Intelligence. You can:</p>
          <ul>
            <li>Upload BOL / Packing List → auto-fill invoice fields</li>
            <li>Upload tracking screenshots → bulk update railcar locations</li>
            <li>Ask questions about POs, invoices, payments, or revenue</li>
            <li>Create POs and invoices by voice/text</li>
          </ul>
        </Section>

        <Section title="Creating an Invoice from a Document">
          <ol>
            <li>Open ✦ BZA Intelligence</li>
            <li>Click "Process invoice document" or drag & drop the BOL + PL</li>
            <li>The AI extracts: railcar, delivery note, tons, bales, date, destination</li>
            <li>It will ask you for: BZA PO #, client PO #, invoice number</li>
            <li>Confirm and the invoice is created automatically</li>
          </ol>
        </Section>

        <Section title="Updating Tracking / Shipments">
          <p>Take a screenshot of your tracking report (CPKC, TTX, etc.) and drop it into BZA Intelligence. It will bulk-update all railcar locations and ETAs at once.</p>
        </Section>

        <Section title="Contact">
          <p>For technical issues, contact <strong>Eduardo Bazua</strong> at <a href="mailto:ebazua@bza-is.com" className="text-[#0d9488]">ebazua@bza-is.com</a></p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <h2 className="font-semibold text-stone-800 mb-3">{title}</h2>
      <div className="text-sm text-stone-600 space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1">
        {children}
      </div>
    </div>
  );
}
