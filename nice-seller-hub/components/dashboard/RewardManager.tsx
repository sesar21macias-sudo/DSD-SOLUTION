"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Eye, EyeOff, Gift, Plus, Trash2, X } from "lucide-react";
import {
  createRewardAction,
  deleteRewardAction,
  toggleRewardAction,
  type LoyaltyState,
} from "@/app/dashboard/loyalty/actions";
import { REWARD_KINDS, rewardValueLabel, type RewardKind } from "@/lib/loyalty-rules";
import type { LoyaltyReward } from "@/db/schema";
import { Button, ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Las recompensas del club.
 *
 * El formulario esta plegado hasta que ella lo pide: la mayoria de las veces
 * que entra a esta pantalla es a mirar lo que ya tiene, no a crear algo nuevo.
 *
 * Apagar una recompensa se ofrece antes que borrarla, y esa es la diferencia
 * importante: apagada deja de ofrecerse pero los cupones que ya se canjearon
 * siguen valiendo. Borrarla tampoco los cancela — alguien tiene ese codigo
 * guardado.
 */
export function RewardManager({
  rewards,
  enabled,
}: {
  rewards: LoyaltyReward[];
  enabled: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<RewardKind>("percent");
  const [pending, startTransition] = useTransition();

  const [state, action, saving] = useActionState<LoyaltyState, FormData>(createRewardAction, {
    ok: false,
  });

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      setOpen(false);
      router.refresh();
    }
  }, [state, router, toast]);

  function run(fn: () => Promise<LoyaltyState>) {
    startTransition(async () => {
      const result = await fn();
      if (result.message) toast(result.message);
      router.refresh();
    });
  }

  const kindHint = REWARD_KINDS.find((k) => k.id === kind)?.hint;

  return (
    <>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-[17px] font-semibold">
            <Gift size={17} strokeWidth={1.8} className="text-mute" />
            Recompensas
          </h2>
          <p className="mt-1 text-[13px] text-mute">
            Lo que tus clientas pueden pedir a cambio de sus puntos.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-3 text-[13px] font-medium transition-colors hover:border-ink/25"
        >
          {open ? <X size={14} strokeWidth={2} /> : <Plus size={14} strokeWidth={2} />}
          {open ? "Cancelar" : "Agregar"}
        </button>
      </div>

      {!enabled && (
        <p className="mb-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-amber-800">
          El club está apagado: puedes preparar tus recompensas, pero nadie las verá hasta que lo
          enciendas arriba.
        </p>
      )}

      {open && (
        <form
          action={action}
          className="animate-fade-up mb-5 max-w-lg space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card"
        >
          <Field label="Nombre de la recompensa">
            <Input name="name" placeholder="10% en tu siguiente compra" required maxLength={80} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Qué le das">
              <Select
                name="kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as RewardKind)}
              >
                {REWARD_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Cuánto cuesta" hint="En puntos.">
              <Input
                name="pointsCost"
                type="number"
                min={1}
                max={100000}
                defaultValue={500}
                required
                inputMode="numeric"
              />
            </Field>
          </div>

          {kind !== "gift" && (
            <Field
              label={kind === "percent" ? "Porcentaje de descuento" : "Descuento en pesos"}
              hint={kindHint}
            >
              <Input
                name="value"
                placeholder={kind === "percent" ? "10" : "150"}
                inputMode="decimal"
                maxLength={8}
                required
              />
            </Field>
          )}

          <Field label="Descripción" hint="Opcional. Una línea para que quede claro.">
            <Textarea
              name="description"
              rows={2}
              maxLength={200}
              placeholder="Aplica en cualquier pieza, sin mínimo de compra."
            />
          </Field>

          {state.error && <ErrorNote>{state.error}</ErrorNote>}

          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Guardando…" : "Agregar recompensa"}
          </Button>
        </form>
      )}

      {rewards.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-5 py-10 text-center text-[13px] leading-relaxed text-mute">
          Todavía no tienes recompensas.
          <br />
          Una buena para empezar: 10% de descuento por 500 puntos.
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {rewards.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-4 py-3.5">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                  r.isActive ? "bg-gold-soft text-gold" : "bg-canvas text-mute-soft"
                }`}
              >
                <Gift size={17} strokeWidth={1.6} />
              </span>

              <div className="min-w-0 flex-1">
                <p
                  className={`truncate text-[14px] font-medium ${
                    r.isActive ? "" : "text-mute line-through"
                  }`}
                >
                  {r.name}
                </p>
                <p className="text-[11px] text-mute">
                  <span className="tabular-nums">{r.pointsCost} pts</span>
                  {" · "}
                  {rewardValueLabel(r.kind, r.value, "Regalo")}
                </p>
              </div>

              <button
                onClick={() => run(() => toggleRewardAction(r.id))}
                disabled={pending}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-canvas hover:text-ink disabled:opacity-40"
                aria-label={r.isActive ? "Dejar de ofrecerla" : "Volver a ofrecerla"}
                title={r.isActive ? "Dejar de ofrecerla" : "Volver a ofrecerla"}
              >
                {r.isActive ? <Eye size={16} strokeWidth={1.8} /> : <EyeOff size={16} strokeWidth={1.8} />}
              </button>

              <button
                onClick={() => {
                  if (confirm(`¿Eliminar "${r.name}"? Los cupones ya canjeados siguen valiendo.`)) {
                    run(() => deleteRewardAction(r.id));
                  }
                }}
                disabled={pending}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-mute transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                aria-label="Eliminar"
              >
                <Trash2 size={16} strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
