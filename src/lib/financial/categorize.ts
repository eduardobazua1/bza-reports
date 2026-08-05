import { db } from "@/db";
import { transactionCategoryRules } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export type TxCategory =
  | "Revenue" | "COGS" | "OpEx" | "Capital" | "Distribution"
  | "Other Income" | "Internal Transfer" | "Uncategorized";

export interface CategoryResult {
  category: TxCategory;
  subcategory: string | null;
  vendorName: string | null;
  matchedRuleId: number | null;
}

export interface CategoryRule {
  id: number;
  pattern: string;
  matchType: "contains" | "starts_with" | "regex";
  category: TxCategory;
  subcategory: string | null;
  vendorName: string | null;
  priority: number;
}

/** Load active rules ordered by priority (highest first). Cache per request. */
export async function loadRules(): Promise<CategoryRule[]> {
  const rows = await db
    .select()
    .from(transactionCategoryRules)
    .where(eq(transactionCategoryRules.active, true))
    .orderBy(desc(transactionCategoryRules.priority));
  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    matchType: r.matchType as CategoryRule["matchType"],
    category: r.category as TxCategory,
    subcategory: r.subcategory,
    vendorName: r.vendorName,
    priority: r.priority,
  }));
}

/** Apply the first matching rule (highest priority) to a transaction description. */
export function categorize(description: string, rules: CategoryRule[]): CategoryResult {
  const d = description.toUpperCase();
  for (const rule of rules) {
    const p = rule.pattern.toUpperCase();
    let matched = false;
    if (rule.matchType === "contains") matched = d.includes(p);
    else if (rule.matchType === "starts_with") matched = d.startsWith(p);
    else if (rule.matchType === "regex") {
      try { matched = new RegExp(rule.pattern, "i").test(description); } catch { matched = false; }
    }
    if (matched) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        vendorName: rule.vendorName,
        matchedRuleId: rule.id,
      };
    }
  }
  return { category: "Uncategorized", subcategory: null, vendorName: null, matchedRuleId: null };
}
