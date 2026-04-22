"use client";

import { useState, useTransition } from "react";
import { updatePurchaseOrder } from "@/server/actions";
import { useRouter } from "next/navigation";

const statuses = [
  { value: "active", label: "Active", color: "bg-green-100 text-[#0d9488]" },
  { value: "completed", label: "Completed", color: "bg-blue-100 text-[#0d9488]" },
  { value: "cancelled", label: "Cancelled", color: "bg-[#0d3d3b] text-[#0d3d3b]" },
] as const;

export function POStatusToggle({ poId, currentStatus }: { poId: number; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const current = statuses.find((s) => s.value === currentStatus) || statuses[0];

  function handleChange(newStatus: string) {
    if (newStatus === currentStatus) { setOpen(false); return; }
    startTransition(async () => {
      await updatePurchaseOrder(poId, { status: newStatus as "active" | "completed" | "cancelled" });
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`px-2 py-1 rounded text-xs font-medium cursor-pointer hover:opacity-80 ${current.color}`}
      >
        {current.label}
      </button>
    );
  }

  return (
    <div className="flex gap-1">
      {statuses.map((s) => (
        <button
          key={s.value}
          onClick={() => handleChange(s.value)}
          disabled={isPending}
          className={`px-2 py-1 rounded text-xs font-medium ${
            s.value === currentStatus ? s.color : "bg-muted text-muted-foreground hover:opacity-80"
          } disabled:opacity-50`}
        >
          {isPending ? "..." : s.label}
        </button>
      ))}
    </div>
  );
}
