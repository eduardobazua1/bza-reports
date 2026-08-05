export const dynamic = "force-dynamic";

import { getCreditInsuranceData } from "@/server/credit-insurance";
import { CreditInsuranceClient } from "@/components/credit-insurance-client";

export default async function CreditInsurancePage() {
  const data = await getCreditInsuranceData();
  return <CreditInsuranceClient data={data} />;
}
