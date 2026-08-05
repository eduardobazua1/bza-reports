// Shared helper for mutating requests (POST/PATCH/PUT/DELETE) from client components.
// Guarantees the UI never "lies": it retries transient network failures, detects an
// expired session (middleware redirects the request to /login, which arrives as 200
// HTML), checks res.ok, and throws a clean Error on any failure. Callers should only
// update local state AFTER this resolves, and show err.message on catch.
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session expired. Reload the page and log in again, then retry.");
    this.name = "SessionExpiredError";
  }
}

export async function apiMutate<T = unknown>(url: string, options: RequestInit = {}): Promise<T | null> {
  // Retry ONLY when fetch throws (network-level) — the request never reached the
  // server, so a retry can't create a duplicate. HTTP error responses are not retried.
  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      res = await fetch(url, options);
      break;
    } catch {
      if (attempt < 2) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  if (!res) {
    throw new Error("Couldn't reach the server. Check that the app is running, then try again.");
  }
  if (res.redirected || res.url.includes("/login")) {
    throw new SessionExpiredError();
  }
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!res.ok) {
    let msg = `Request failed (error ${res.status}).`;
    if (isJson) {
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch { /* keep default */ }
    }
    throw new Error(msg);
  }
  if (isJson) {
    try {
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }
  return null;
}
