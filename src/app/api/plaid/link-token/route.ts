import { NextResponse } from "next/server";
import { plaidClient, plaidConfigured } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

export const dynamic = "force-dynamic";

// Creates a short-lived link_token that the Plaid Link widget uses to start the flow.
export async function POST() {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: "Plaid is not configured (PLAID_CLIENT_ID / PLAID_SECRET missing)." }, { status: 400 });
  }
  try {
    const client = plaidClient();
    const r = await client.linkTokenCreate({
      user: { client_user_id: "bza-tms" },
      client_name: "BZA International Services",
      products: [Products.Transactions],
      transactions: { days_requested: 730 }, // pull up to 24 months of history (Plaid max)
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: r.data.link_token });
  } catch (e) {
    const err = e as { response?: { data?: { error_code?: string; error_message?: string; display_message?: string } }; message?: string };
    const d = err.response?.data;
    const msg = d
      ? [d.error_code, d.display_message || d.error_message].filter(Boolean).join(": ") || JSON.stringify(d)
      : (err.message ?? "link token failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
