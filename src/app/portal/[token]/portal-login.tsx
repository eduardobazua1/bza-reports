"use client";

import { useState } from "react";

export function PortalLogin({ token }: { token: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send-code", email: email.trim(), token }),
      });
      const data = await res.json();

      if (data.sent) {
        setName(data.name);
        setStep("code");
      } else if (data.error) {
        // Show generic message for security
        setStep("code");
        setName("");
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/portal/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", email: email.trim(), code, token }),
      });
      const data = await res.json();

      if (data.verified) {
        // Reload page — server will see the cookie and show portal
        window.location.reload();
      } else {
        setError(data.error || "Invalid code. Please try again.");
      }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/bza-logo1.png" alt="BZA International Services" className="h-16 mx-auto mb-4 object-contain rounded-xl" />
          <h1 className="text-xl font-semibold text-stone-800">Shipment Portal</h1>
          <p className="text-sm text-stone-400 mt-1">Secure access to your shipment data</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          {step === "email" ? (
            <form onSubmit={handleSendCode}>
              <h2 className="text-base font-medium text-stone-800 mb-1">Welcome</h2>
              <p className="text-sm text-stone-400 mb-5">Enter your email to receive an access code</p>

              <label className="block text-xs font-medium text-stone-500 mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full mt-4 bg-stone-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Sending code..." : "Continue"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify}>
              {name && (
                <h2 className="text-base font-medium text-stone-800 mb-1">Hello, {name}! 👋</h2>
              )}
              <p className="text-sm text-stone-400 mb-5">
                We sent a 6-digit code to <span className="font-medium text-stone-600">{email}</span>
              </p>

              <label className="block text-xs font-medium text-stone-500 mb-1.5">Verification code</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                autoFocus
                maxLength={6}
                className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-center tracking-[8px] font-mono text-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />

              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full mt-4 bg-stone-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Verifying..." : "Verify & Access Portal"}
              </button>

              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setError(""); }}
                className="w-full mt-2 text-sm text-stone-400 hover:text-stone-600"
              >
                ← Use a different email
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-stone-300 mt-6">
          BZA International Services, LLC · McAllen, TX
        </p>
      </div>
    </div>
  );
}
