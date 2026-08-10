import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Which Plaid environment: sandbox (fake banks, free) | production (real banks).
const ENV = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;

export function plaidConfigured(): boolean {
  return !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidClient(): PlaidApi {
  const configuration = new Configuration({
    basePath: PlaidEnvironments[ENV],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
        "PLAID-SECRET": process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(configuration);
}

// Map a Plaid account subtype to the TMS bank_accounts.account_type enum.
export function mapAccountType(subtype: string | null | undefined): "checking" | "money_market" | "savings" | "other" {
  const s = (subtype || "").toLowerCase();
  if (s.includes("checking")) return "checking";
  if (s.includes("money")) return "money_market";
  if (s.includes("saving")) return "savings";
  return "other";
}
