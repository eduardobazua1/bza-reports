export const metadata = {
  title: "Privacy Policy — BZA International Services",
  description: "Privacy Policy for the BZA TMS internal application.",
};

const UPDATED = "August 11, 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-stone-800">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="mb-10 border-b border-stone-200 pb-6">
          <div className="text-lg font-bold text-[#0d3d3b]">BZA International Services LLC</div>
          <h1 className="mt-2 text-3xl font-bold text-stone-900">Privacy Policy</h1>
          <p className="mt-2 text-sm text-stone-500">Last updated: {UPDATED}</p>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">1. Who we are</h2>
            <p>
              BZA International Services LLC (&ldquo;BZA,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) operates an
              internal transportation and accounting management system (the &ldquo;TMS&rdquo;) used solely by BZA
              to manage its own operations, invoicing, and financial records. Our address is 1209 S. 10th St.,
              Suite #583, McAllen, TX 78501. Questions about this policy can be sent to{" "}
              <a className="text-[#0d3d3b] underline" href="mailto:info@bza-is.com">info@bza-is.com</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">2. Scope</h2>
            <p>
              The TMS is an internal-only application. It has no external consumer end-users. The only person who
              connects a financial account is BZA itself, connecting the company&rsquo;s own bank account for
              internal bookkeeping and reconciliation.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">3. Information we collect</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li>Company bank account and transaction data, retrieved through Plaid at the account owner&rsquo;s direction.</li>
              <li>Business records BZA itself enters: invoices, purchase orders, suppliers, clients, and shipments.</li>
              <li>Authentication data for the internal users who log in to operate the system.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">4. How we use Plaid</h2>
            <p>
              We use Plaid Inc. to connect BZA&rsquo;s own bank account and import transaction history into the TMS.
              By connecting an account through Plaid Link, the account owner authorizes this access. Plaid&rsquo;s
              handling of data is governed by Plaid&rsquo;s own privacy policy at{" "}
              <a className="text-[#0d3d3b] underline" href="https://plaid.com/legal/#end-user-privacy-policy">
                plaid.com/legal
              </a>
              . We use the imported data exclusively for internal financial reconciliation, bookkeeping, and reporting.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">5. How we protect data</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li>All access to the TMS requires authentication.</li>
              <li>Bank access tokens are encrypted at rest with AES-256-GCM and are never exposed to the browser.</li>
              <li>Data in transit is encrypted with TLS 1.2 or better.</li>
              <li>The database and encrypted daily backups are hosted on managed cloud infrastructure (Vercel, Turso).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">6. Sharing</h2>
            <p>
              We do not sell, rent, or share data with third parties for their own purposes. Data is processed only by
              the infrastructure providers that host the TMS (Plaid for the bank connection, and Vercel and Turso for
              hosting and storage), acting on our behalf.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">7. Retention and deletion</h2>
            <p>
              We keep financial records for as long as needed for accounting, tax, and audit purposes, consistent with
              applicable law. A connected bank account can be disconnected at any time, after which the associated
              access token is revoked and deleted. See our{" "}
              <a className="text-[#0d3d3b] underline" href="/security">Security &amp; Data Practices</a> page for details.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">8. Your choices</h2>
            <p>
              Because the only account owner is BZA itself, BZA can revoke the bank connection, request deletion of
              imported data, or ask questions at any time by contacting{" "}
              <a className="text-[#0d3d3b] underline" href="mailto:info@bza-is.com">info@bza-is.com</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">9. Changes</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected by the &ldquo;Last
              updated&rdquo; date above.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-400">
          © {new Date().getFullYear()} BZA International Services LLC · McAllen, TX
        </div>
      </div>
    </main>
  );
}
