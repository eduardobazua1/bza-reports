// Retries a promise-returning fn on transient failures (e.g. a remote Turso
// query hiccup over the network). Read queries are idempotent, so re-running
// the whole load is safe. Prevents the "blank page, works on reload" symptom.
export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 150,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, baseDelayMs * (i + 1)));
      }
    }
  }
  throw lastErr;
}
