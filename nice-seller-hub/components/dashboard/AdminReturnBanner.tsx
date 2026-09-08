"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { returnToAdmin } from "@/app/admin/sellers/actions";

/**
 * Se ve solo cuando el admin entró como soporte a esta tienda.
 *
 * Es la unica forma de volver a su propia sesion sin cerrar sesion y volver a
 * escribir su contraseña — la cuenta de admin queda guardada aparte mientras
 * dura esta visita.
 */
export function AdminReturnBanner({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function back() {
    startTransition(async () => {
      const res = await returnToAdmin();
      if (res.ok) {
        router.replace("/admin/sellers");
        router.refresh();
      }
    });
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 flex h-10 items-center justify-center gap-3 bg-amber-500 px-4 text-[13px] font-medium text-white shadow-md">
      <ShieldAlert size={15} strokeWidth={2} />
      <span className="truncate">Viendo el panel de {businessName} como soporte</span>
      <button
        onClick={back}
        disabled={pending}
        className="shrink-0 rounded-md bg-black/15 px-2.5 py-1 text-[12px] font-semibold transition-colors hover:bg-black/25 disabled:opacity-60"
      >
        {pending ? "Volviendo…" : "Volver a admin"}
      </button>
    </div>
  );
}
