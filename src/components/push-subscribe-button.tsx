"use client";

import { useEffect, useState } from "react";
import { BellOff, BellRing, Loader2 } from "lucide-react";

type State = "idle" | "loading" | "subscribed" | "denied" | "unsupported";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushSubscribeButton() {
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription();
      if (existing) setState("subscribed");
    }).catch(() => {});
  }, []);

  async function subscribe() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;

      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      });

      const json = sub.toJSON();
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
      });

      setState("subscribed");
    } catch (err) {
      console.error("Push subscribe error:", err);
      setState("idle");
    }
  }

  async function unsubscribe() {
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("idle");
    } catch {
      setState("subscribed");
    }
  }

  if (state === "unsupported") return null;

  if (state === "subscribed") {
    return (
      <button
        onClick={unsubscribe}
        title="Disable push notifications"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0d3d3b]/10 text-[#0d3d3b] hover:bg-[#0d3d3b]/20 transition-colors"
      >
        <BellRing className="w-3.5 h-3.5" />
        Push on
      </button>
    );
  }

  if (state === "denied") {
    return (
      <div
        title="Notifications blocked in browser settings"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-stone-100 text-stone-400 cursor-not-allowed"
      >
        <BellOff className="w-3.5 h-3.5" />
        Blocked
      </div>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={state === "loading"}
      title="Get push notifications on this device"
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#0d3d3b] text-white hover:bg-[#0a5c5a] transition-colors disabled:opacity-60"
    >
      {state === "loading"
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <BellRing className="w-3.5 h-3.5" />
      }
      Enable push
    </button>
  );
}
