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
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return NextResponse.json({ link_token: r.data.link_token });
  } catch (e) {
    const err = e as { response?: { data?: unknown }; message?: string };
    return NextResponse.json({ error: err.response?.data ?? err.message ?? "link token failed" }, { status: 500 });
  }
}
