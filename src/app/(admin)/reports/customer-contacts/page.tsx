import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getClients } from "@/server/queries";

export default async function CustomerContactsPage() {
  const clients = await getClients();

  function CertBadge({ certType }: { certType: string | null }) {
    if (certType === "fsc")
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
          FSC
        </span>
      );
    if (certType === "pefc")
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
          PEFC
        </span>
      );
    return <span className="text-gray-400">—</span>;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link
        href="/reports"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Reports
      </Link>

      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Customer Contact List</h1>
        <span className="text-sm text-gray-500">{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Contact</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Phone</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">City / Country</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Payment Terms</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Cert</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-gray-900 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-gray-700">{c.contactName || <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">
                  {c.contactEmail ? (
                    <a href={`mailto:${c.contactEmail}`} className="text-teal-700 hover:underline">
                      {c.contactEmail}
                    </a>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{c.phone || <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3 text-gray-700">
                  {[c.city, c.country].filter(Boolean).join(", ") || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {c.paymentTermsDays != null ? `Net ${c.paymentTermsDays}` : <span className="text-gray-400">—</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <CertBadge certType={c.certType} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
