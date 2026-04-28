"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 print:hidden"
    >
      <Printer className="w-4 h-4" /> Print
    </button>
  );
}
