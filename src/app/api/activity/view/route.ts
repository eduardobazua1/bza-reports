import { NextRequest, NextResponse } from "next/server";
import { logActivity } from "@/server/activity";

// Records a page view for the current user. Fire-and-forget from the client.
export async function POST(req: NextRequest) {
  try {
    const { path, label } = await req.json();
    if (typeof path === "string" && path) {
      await logActivity({
        action: "view",
        entity: "page",
        entityLabel: (typeof label === "string" && label) || path,
        meta: { path },
      });
    }
  } catch { /* never block navigation on logging */ }
  return NextResponse.json({ ok: true });
}
