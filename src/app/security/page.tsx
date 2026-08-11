export const metadata = {
  title: "Security & Data Practices — BZA International Services",
  description: "Information Security and Data Retention practices for the BZA TMS.",
};

const UPDATED = "August 11, 2026";

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-white text-stone-800">
      <div className="mx-auto max-w-3xl px-6 py-14">
        <div className="mb-10 border-b border-stone-200 pb-6">
          <div className="text-lg font-bold text-[#0d3d3b]">BZA International Services LLC</div>
          <h1 className="mt-2 text-3xl font-bold text-stone-900">Security &amp; Data Practices</h1>
          <p className="mt-2 text-sm text-stone-500">Last updated: {UPDATED}</p>
        </div>

        <div className="space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">Overview</h2>
            <p>
              The BZA TMS is an internal-only application operated by BZA International Services LLC. This page
              summarizes the information-security and data-retention practices that govern it. The owner of BZA is
              responsible for information security and can be reached at{" "}
              <a className="text-[#0d3d3b] underline" href="mailto:ebazua@bza-is.com">ebazua@bza-is.com</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">Access control</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li>All access to the TMS requires authentication with unique credentials.</li>
              <li>Access follows the principle of least privilege; administrative access is limited to the owner.</li>
              <li>Multi-factor authentication is enabled on the accounts of the critical systems that host the application and data (Vercel, Turso, GitHub).</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">Encryption</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li><b>In transit:</b> all traffic is encrypted with TLS 1.2 or better.</li>
              <li><b>At rest:</b> bank access tokens are encrypted with AES-256-GCM and are never exposed to the browser. Daily full-database backups are encrypted with AES-256 before storage.</li>
              <li>Data received from the Plaid API is stored on managed cloud infrastructure and protected as described above.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">Infrastructure</h2>
            <p>
              The application runs on Vercel and the database on Turso — managed cloud providers that maintain
              their own SOC 2 controls and are responsible for patching the underlying infrastructure. Application
              dependencies are monitored for known vulnerabilities.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">Backups &amp; recovery</h2>
            <p>
              A full encrypted backup of the database is generated automatically every day and retained off-site.
              A documented restore procedure allows the system to be recovered from any recent backup.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">Data retention &amp; deletion</h2>
            <ul className="ml-5 list-disc space-y-1">
              <li>Financial and operational records are retained for as long as required for accounting, tax, and audit purposes, consistent with applicable law.</li>
              <li>A connected bank account can be disconnected at any time; the associated Plaid access token is then revoked and deleted.</li>
              <li>This policy is reviewed periodically by the owner.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-[#0d3d3b]">Consent</h2>
            <p>
              The company&rsquo;s own bank account is connected only at the explicit direction of the account owner
              through Plaid Link&rsquo;s consent flow. There are no external consumer end-users.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-stone-200 pt-6 text-sm text-stone-400">
          © {new Date().getFullYear()} BZA International Services LLC · McAllen, TX ·{" "}
          <a className="text-[#0d3d3b] underline" href="/privacy">Privacy Policy</a>
        </div>
      </div>
    </main>
  );
}
