export const dynamic = "force-dynamic";

import { db } from "@/db";
import { certificates } from "@/db/schema";
import { desc } from "drizzle-orm";
import { CertificatesClient } from "@/components/certificates-client";

export default async function CertificatesPage() {
  const rows = await db
    .select({
      id: certificates.id,
      name: certificates.name,
      certType: certificates.certType,
      certCode: certificates.certCode,
      issuedBy: certificates.issuedBy,
      issuedTo: certificates.issuedTo,
      validFrom: certificates.validFrom,
      validUntil: certificates.validUntil,
      standard: certificates.standard,
      notes: certificates.notes,
      fileName: certificates.fileName,
      fileSize: certificates.fileSize,
      createdAt: certificates.createdAt,
    })
    .from(certificates)
    .orderBy(desc(certificates.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">Certificates</h1>
      </div>
      <CertificatesClient initialCerts={rows} />
    </div>
  );
}
