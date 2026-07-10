"use client";

import type { Mode } from "@/lib/db";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

export default function ModeToggle({ mode, onChange, disabled }: Props) {
  const isAi = mode === "AI";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(isAi ? "HUMAN" : "AI")}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        isAi
          ? "border-emerald-700 bg-emerald-950 text-emerald-300"
          : "border-amber-700 bg-amber-950 text-amber-300"
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${isAi ? "bg-emerald-400" : "bg-amber-400"}`} />
      {isAi ? "Modo IA" : "Modo Humano"}
    </button>
  );
}
