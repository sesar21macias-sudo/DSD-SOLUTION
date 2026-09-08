"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { impersonateSeller } from "@/app/admin/sellers/actions";

/** Entrar al panel de una distribuidora como soporte, sin su contraseña. */
export function ImpersonateButton({ sellerId }: { sellerId: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    setError(null);
    startTransition(async () => {
      const res = await impersonateSeller(sellerId);
      if (!res.ok) {
        setError(res.error ?? "No se pudo entrar.");
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <div>
      <button
        onClick={go}
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink/25 hover:text-ink disabled:opacity-40"
      >
        <LogIn size={13} strokeWidth={1.9} />
        {pending ? "Entrando…" : "Entrar como"}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
