"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BzaLogo } from "@/components/bza-logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [stage, setStage] = useState<"credentials" | "mfa">("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function finishSignIn(code?: string) {
    const result = await signIn("credentials", {
      email, password, token: code ?? "", redirect: false,
    });
    if (result?.error) {
      setError(stage === "mfa" ? "Invalid authentication code" : "Invalid email or password");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (stage === "credentials") {
      // Step 1: verify password and find out whether a second factor is needed.
      try {
        const r = await fetch("/api/login/precheck", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const d = await r.json();
        if (!d.valid) { setError("Invalid email or password"); setLoading(false); return; }
        if (d.mfaRequired) { setStage("mfa"); setLoading(false); return; }
        await finishSignIn();
      } catch {
        setError("Something went wrong. Try again.");
        setLoading(false);
      }
    } else {
      // Step 2: complete sign-in with the TOTP code.
      await finishSignIn(token);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><BzaLogo size="lg" /></div>
          <p className="text-stone-400 text-sm">
            {stage === "credentials" ? "Sign in to your account" : "Two-factor authentication"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {stage === "credentials" ? (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Authentication code</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={6}
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="w-full px-3 py-2 border border-border rounded-lg tracking-[0.4em] text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              />
              <p className="text-xs text-stone-400 mt-1.5">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>
          )}

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || (stage === "mfa" && token.length !== 6)}
            className="w-full bg-primary text-primary-foreground py-2 rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Please wait…" : stage === "credentials" ? "Sign In" : "Verify"}
          </button>

          {stage === "mfa" && (
            <button
              type="button"
              onClick={() => { setStage("credentials"); setToken(""); setError(""); }}
              className="w-full text-stone-400 text-sm hover:text-stone-600"
            >
              ← Back
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
