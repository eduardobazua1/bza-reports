import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Latest published SOFR from the Federal Reserve Bank of New York (official source).
// SOFR is published each business morning for the prior business day.
export async function GET() {
  try {
    const r = await fetch(
      "https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json",
      { next: { revalidate: 3600 }, headers: { Accept: "application/json" } } // cache 1h — it only changes once a day
    );
    if (!r.ok) throw new Error(`NY Fed responded ${r.status}`);
    const data = await r.json();
    const row = data?.refRates?.[0];
    if (!row || typeof row.percentRate !== "number") throw new Error("Unexpected SOFR payload");
    return NextResponse.json({ rate: row.percentRate, date: row.effectiveDate as string });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Could not fetch SOFR" }, { status: 502 });
  }
}
