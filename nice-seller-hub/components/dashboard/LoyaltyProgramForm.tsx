"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { saveProgramAction, type LoyaltyState } from "@/app/dashboard/loyalty/actions";
import type { LoyaltyProgram } from "@/db/schema";
import { Button, ErrorNote, Field, Input, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Las reglas del club.
 *
 * El interruptor va arriba y aparte porque es la decision de verdad: mientras
 * este apagado no se acumula un solo punto, y eso es a proposito. Encender un
 * club un año despues y descubrir que ya le debes recompensas a media cartera
 * seria peor que no tenerlo.
 *
 * La tasa se pide en pesos ("1 punto por cada $___") y no en centavos ni en
 * "puntos por peso": es como lo diria ella al explicarselo a una clienta.
 */
export function LoyaltyProgramForm({
  program,
  slug,
}: {
  program: LoyaltyProgram;
  slug: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<LoyaltyState, FormData>(saveProgramAction, {
    ok: false,
  });

  const [enabled, setEnabled] = useState(program.enabled);
  const [pesos, setPesos] = useState(String(Math.round(program.centsPerPoint / 100)));

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      router.refresh();
    }
  }, [state, router, toast]);

  const pesosNum = Number(pesos) || 0;

  return (
    <form action={action} className="max-w-lg">
      <div
        className={`rounded-2xl border p-5 shadow-card transition-colors duration-300 ${
          enabled ? "border-gold/40 bg-gold-soft/30" : "border-line bg-surface"
        }`}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            name="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ink)]"
          />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-[15px] font-medium">
              <Sparkles size={14} strokeWidth={2} className="text-gold" />
              Club de puntos activo
            </span>
            <span className="mt-1 block text-[13px] leading-relaxed text-mute">
              {enabled
                ? `Tus clientas ya pueden registrarse en nicehub.com/${slug}/club y acumular puntos con cada venta que registres.`
                : "Mientras esté apagado nadie acumula puntos y la página del club no aparece en tu tienda."}
            </span>
          </span>
        </label>
      </div>

      <div className="mt-5 space-y-5">
        <Field label="Cómo se llama tu club" hint="Es lo que verán tus clientas.">
          <Input name="name" defaultValue={program.name} maxLength={40} required />
        </Field>

        <Field
          label="1 punto por cada…"
          hint={
            pesosNum > 0
              ? `Una compra de $1,000 le daría ${Math.floor(1000 / pesosNum)} puntos.`
              : "En pesos."
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-mute">
              $
            </span>
            <Input
              name="pesosPerPoint"
              value={pesos}
              onChange={(e) => setPesos(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              maxLength={4}
              required
              className="pl-7"
            />
          </div>
        </Field>

        <Field
          label="Puntos de bienvenida"
          hint="Se los damos una sola vez, al registrarse. Déjalo en 0 si no quieres."
        >
          <Input
            name="welcomePoints"
            type="number"
            min={0}
            max={5000}
            defaultValue={program.welcomePoints}
            inputMode="numeric"
          />
        </Field>

        <Field
          label="Condiciones"
          hint="Opcional. Aparece al final de la página del club, tal como lo escribas."
        >
          <Textarea
            name="terms"
            defaultValue={program.terms ?? ""}
            rows={3}
            maxLength={600}
            placeholder="Los puntos no son transferibles ni canjeables por dinero."
          />
        </Field>
      </div>

      {state.error && (
        <div className="mt-5">
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      )}

      <Button type="submit" disabled={pending} className="mt-6">
        {pending ? "Guardando…" : "Guardar programa"}
      </Button>
    </form>
  );
}
