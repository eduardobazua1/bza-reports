export const dynamic = "force-dynamic";

import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { SupplierActions } from "@/components/supplier-actions";

export default async function SuppliersPage() {
  const rows = await db.select().from(suppliers).orderBy(suppliers.name);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Suppliers</h1>
      <SupplierActions suppliers={rows} />
    </div>
  );
}
