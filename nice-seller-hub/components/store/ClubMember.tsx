"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Gift, MessageCircle, Sparkles, Ticket } from "lucide-react";
import {
  leaveClubAction,
  redeemAction,
  type ClubState,
} from "@/app/[seller]/club/actions";
import { formatDate, formatNumber } from "@/lib/format";
import { renderTemplate } from "@/lib/message-templates";
import { firstName } from "@/lib/whatsapp";
import { ErrorNote } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * La tarjeta del club.
 *
 * Es la pantalla que la clienta va a abrir mas veces, casi siempre para lo
 * mismo: cuantos puntos llevo y que puedo pedir con ellos. Por eso los puntos
 * son lo primero y lo mas grande, y las recompensas que ya alcanza aparecen
 * antes que las que le faltan.
 */

interface Reward {
  id: number;
  name: string;
  description: string | null;
  pointsCost: number;
  kind: string;
  value: number;
}

interface Redemption {
  id: number;
  code: string;
  name: string;
  status: string;
  createdAt: string;
}

interface Movement {
  id: number;
  points: number;
  description: string | null;
  createdAt: string;
}

export function ClubMember(props: {
  slug: string;
  programName: string;
  rateText: string;
  terms: string | null;
  businessName: string;
  whatsapp: string;
  couponMessageTemplate: string | null;
  customerName: string;
  points: number;
  lifetimePoints: number;
  tier: { name: string; className: string };
  next: { tier: { name: string; min: number }; missing: number } | null;
  rewards: Reward[];
  redemptions: Redemption[];
  movements: Movement[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ClubState, FormData>(redeemAction, {
    ok: false,
  });

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      router.refresh();
    }
  }, [state, router, toast]);

  // Las que ya alcanza, primero. Es lo que hace que la pantalla se sienta un
  // premio y no una lista de pendientes.
  const affordable = props.rewards.filter((r) => r.pointsCost <= props.points);
  const locked = props.rewards.filter((r) => r.pointsCost > props.points);

  const active = props.redemptions.filter((r) => r.status === "available");
  const spent = props.redemptions.filter((r) => r.status !== "available");

  const progress = props.next
    ? Math.min(100, Math.round((props.lifetimePoints / props.next.tier.min) * 100))
    : 100;

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 pt-4">
      {/* La tarjeta */}
      <section className="animate-scale-in card-foil relative overflow-hidden rounded-[26px] p-6 text-white shadow-lift">
        <div className="relative">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/60">
            <Sparkles size={11} strokeWidth={2} />
            {props.programName}
          </p>

          <p className="mt-5 font-display text-[52px] font-normal leading-none tabular-nums">
            {formatNumber(props.points)}
          </p>
          <p className="mt-1 text-[13px] text-white/60">
            {props.points === 1 ? "punto disponible" : "puntos disponibles"}
          </p>

          <div className="mt-6 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-medium">{props.customerName}</p>
              <p className="text-[12px] text-white/50">{props.businessName}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.1em] ${props.tier.className}`}
            >
              {props.tier.name}
            </span>
          </div>

          {props.next && (
            <div className="mt-5">
              <div className="h-1 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gold transition-[width] duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-white/50">
                Te faltan {formatNumber(props.next.missing)} puntos para {props.next.tier.name}
              </p>
            </div>
          )}
        </div>
      </section>

      <p className="mt-3 px-1 text-center text-[12px] text-mute">
        {props.rateText} en tus compras con {props.businessName}.
      </p>

      {state.error && (
        <div className="mt-5">
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      )}

      {/* Cupones vigentes */}
      {active.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">
            Tus cupones
          </h2>
          <ul className="mt-3 space-y-2.5">
            {active.map((r) => (
              <CouponCard
                key={r.id}
                redemption={r}
                whatsapp={props.whatsapp}
                businessName={props.businessName}
                messageTemplate={props.couponMessageTemplate}
              />
            ))}
          </ul>
        </section>
      )}

      {/* Recompensas */}
      <section className="mt-8">
        <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">
          Recompensas
        </h2>

        {props.rewards.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-5 py-8 text-center text-[13px] leading-relaxed text-mute">
            {props.businessName} todavía no publica recompensas. Tus puntos se siguen acumulando.
          </p>
        ) : (
          <ul className="stagger mt-3 space-y-2.5">
            {affordable.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl border border-gold/30 bg-gold-soft/40 p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-gold shadow-sm">
                  <Gift size={17} strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium">{r.name}</p>
                  {r.description && (
                    <p className="mt-0.5 text-[12px] leading-snug text-ink-soft">{r.description}</p>
                  )}
                  <p className="mt-0.5 text-[11px] tabular-nums text-gold">{r.pointsCost} puntos</p>
                </div>
                <form action={action} className="shrink-0">
                  <input type="hidden" name="slug" value={props.slug} />
                  <input type="hidden" name="rewardId" value={r.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    className="h-9 rounded-xl bg-ink px-4 text-[13px] font-medium text-white transition-all duration-200 hover:bg-ink-soft active:scale-[0.97] disabled:opacity-40"
                  >
                    {pending ? "…" : "Canjear"}
                  </button>
                </form>
              </li>
            ))}

            {locked.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-canvas text-mute-soft">
                  <Gift size={17} strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-ink-soft">{r.name}</p>
                  {r.description && (
                    <p className="mt-0.5 text-[12px] leading-snug text-mute">{r.description}</p>
                  )}
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-mute-soft transition-[width] duration-700"
                      style={{
                        width: `${Math.min(100, Math.round((props.points / r.pointsCost) * 100))}%`,
                      }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-right text-[11px] leading-tight text-mute">
                  te faltan
                  <br />
                  <span className="font-medium tabular-nums text-ink-soft">
                    {formatNumber(r.pointsCost - props.points)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Movimientos */}
      {props.movements.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-mute">
            Tus movimientos
          </h2>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {props.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px]">{m.description ?? "Movimiento"}</p>
                  <p className="text-[11px] text-mute">{formatDate(m.createdAt)}</p>
                </div>
                <span
                  className={`shrink-0 text-[13px] font-medium tabular-nums ${
                    m.points >= 0 ? "text-emerald-600" : "text-mute"
                  }`}
                >
                  {m.points >= 0 ? "+" : ""}
                  {formatNumber(m.points)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {spent.length > 0 && (
        <p className="mt-4 px-1 text-[12px] text-mute">
          {spent.length} {spent.length === 1 ? "cupón usado" : "cupones usados"} anteriormente.
        </p>
      )}

      {props.terms && (
        <p className="mt-8 whitespace-pre-line rounded-2xl bg-line/40 px-4 py-3.5 text-[12px] leading-relaxed text-mute">
          {props.terms}
        </p>
      )}

      <form action={leaveClubAction} className="mt-8 text-center">
        <button
          type="submit"
          className="text-[13px] text-mute underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          Salir de esta sesión
        </button>
      </form>
    </main>
  );
}

/**
 * El cupon. El codigo es lo unico que la distribuidora necesita para
 * honrarlo, asi que se puede copiar de un toque y mandar por WhatsApp sin
 * escribir nada: teclear "NC-K7M-P3Q" a mano es justo donde se pierde la gente.
 */
function CouponCard({
  redemption,
  whatsapp,
  businessName,
  messageTemplate,
}: {
  redemption: Redemption;
  whatsapp: string;
  businessName: string;
  messageTemplate: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(redemption.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sin portapapeles (Safari en http, permisos negados) el codigo sigue
      // visible en pantalla: no hay nada que avisar.
    }
  }

  const message = renderTemplate("couponMessage", messageTemplate, {
    vendedora: firstName(businessName),
    recompensa: redemption.name,
    codigo: redemption.code,
  });

  return (
    <li className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="flex items-center gap-3 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-white">
          <Ticket size={17} strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{redemption.name}</p>
          <p className="text-[11px] text-mute">Canjeado el {formatDate(redemption.createdAt)}</p>
        </div>
      </div>

      <div className="flex items-stretch border-t border-dashed border-line-strong">
        <button
          onClick={copy}
          className="flex flex-1 items-center justify-center gap-2 py-3 text-[15px] font-semibold tracking-[0.08em] tabular-nums transition-colors hover:bg-canvas"
        >
          {copied ? (
            <Check size={15} strokeWidth={2.2} className="text-emerald-600" />
          ) : (
            <Copy size={14} strokeWidth={1.8} className="text-mute" />
          )}
          {redemption.code}
        </button>
        <a
          href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="grid w-14 shrink-0 place-items-center border-l border-line text-[#25D366] transition-colors hover:bg-canvas"
          aria-label="Enviar por WhatsApp"
        >
          <MessageCircle size={17} strokeWidth={1.9} />
        </a>
      </div>
    </li>
  );
}
