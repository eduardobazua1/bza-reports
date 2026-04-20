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
      if (data.sent) { setName(data.name); setStep("code"); }
      else { setStep("code"); setName(""); }
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
      if (data.verified) { window.location.reload(); }
      else { setError(data.error || "Invalid code. Please try again."); }
    } catch {
      setError("Connection error. Please try again.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-7">
      {/* Logo */}
      <div className="flex flex-col items-center mb-10">
        <div className="w-20 h-20 rounded-[20px] bg-[#0d9488] flex flex-col items-center justify-center mb-0">
          <div className="flex items-center">
            <span className="text-white text-[22px] font-extrabold tracking-wide">BZA</span>
            <span className="w-2 h-2 rounded-full bg-[#ccfbf1] ml-0.5 -mt-3" />
          </div>
          <span className="text-[#ccfbf1] text-[10px] font-semibold tracking-[3px] mt-0.5">tracking</span>
        </div>
      </div>

      <div className="w-full max-w-sm">
        {step === "email" ? (
          <form onSubmit={handleSendCode}>
            <h1 className="text-2xl font-extrabold text-[#1c1917] mb-6">Sign in</h1>

            <label className="block text-[13px] font-semibold text-[#44403c] mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full bg-[#fafaf9] border-[1.5px] border-[#e7e5e4] rounded-xl px-4 py-4 text-[15px] text-[#1c1917] focus:outline-none focus:border-[#0d9488] focus:bg-white transition-colors mb-5"
            />

            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

            <button
              type="submit"
              disabled={loading || !email}
              className="w-full bg-[#0d9488] text-white rounded-[14px] py-[17px] text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending code..." : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify}>
            <h1 className="text-2xl font-extrabold text-[#1c1917] mb-1">
              {name ? `Hello, ${name.split(" ")[0]}` : "Check your email"}
            </h1>
            <p className="text-[13px] text-[#a8a29e] mb-6">
              We sent a code to <span className="text-[#44403c] font-medium">{email}</span>
            </p>

            <label className="block text-[13px] font-semibold text-[#44403c] mb-2">Verification code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoFocus
              maxLength={6}
              placeholder="000000"
              className="w-full bg-[#fafaf9] border-[1.5px] border-[#e7e5e4] rounded-xl px-4 py-4 text-[22px] text-center tracking-[10px] font-mono text-[#1c1917] focus:outline-none focus:border-[#0d9488] focus:bg-white transition-colors mb-5"
            />

            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-[#0d9488] text-white rounded-[14px] py-[17px] text-base font-bold disabled:opacity-50 disabled:cursor-not-allowed mb-3"
            >
              {loading ? "Verifying..." : "Access Portal"}
            </button>

            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="w-full py-3 text-[15px] font-semibold text-[#0d9488]"
            >
              ← Back
            </button>
          </form>
        )}
      </div>

      <p className="absolute bottom-6 text-[11px] text-[#c7c3c0]">BZA International Services, LLC</p>
    </div>
  );
}
