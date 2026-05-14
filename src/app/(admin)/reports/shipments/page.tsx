import { getInvoices } from "@/server/queries";
import { ShipmentsClient } from "@/components/shipments-client";

export const dynamic = "force-dynamic";

export default async function ShipmentsPage() {
  const allInvoices = await getInvoices();
  return <ShipmentsClient allInvoices={allInvoices} />;
}
