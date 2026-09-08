"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { Ban, MessageCircle } from "lucide-react";
import {
  cancelSaleAction,
  registerPayment,
  type ActionState,
} from "@/app/dashboard/actions";
import { PAYMENT_METHODS } from "@/lib/payments";
import { centsToPesosInput, formatMoney } from "@/lib/format";
import { renderTemplate } from "@/lib/message-templates";
import { firstName } from "@/lib/whatsapp";
import { Button, ErrorNote, Field, Input, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Cobrar un abono.
 *
 * Los botones de "todo el saldo" y "la mitad" existen porque son las dos cosas
 * que de verdad pasan en el mostrador, y porque teclear "1,483.50" con una
 * clienta enfrente es donde se equivoca cualquiera.
 */
export function PaymentPanel({
  saleId,
  balanceCents,
  customerName,
  customerPhone,
  businessName,
  messageTemplate,
}: {
  saleId: number;
  balanceCents: number;
  customerName: string | null;
  customerPhone: string | null;
  businessName: string;
  messageTemplate: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [amount, setAmount] = useState("");

  const [state, action, pending] = useActionState<ActionState, FormData>(registerPayment, {
    ok: false,
  });

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      setAmount("");
      router.refresh();
    }
  }, [state, router, toast]);

  const reminder = customerPhone
    ? `https://wa.me/${customerPhone}?text=${encodeURIComponent(
        renderTemplate("paymentReminder", messageTemplate, {
          cliente: customerName ? firstName(customerName) : "",
          tienda: businessName,
          saldo: formatMoney(balanceCents),
        })
      )}`
    : null;

  return (
    <form action={action} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <input type="hidden" name="saleId" value={saleId} />

      <div className="flex items-baseline justify-between">
        <p className="text-[13px] font-medium">Registrar un abono</p>
        <p className="text-[13px] tabular-nums text-mute">
          Saldo {formatMoney(balanceCents)}
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Cuánto te abona">
          <Input
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="En pesos"
            inputMode="decimal"
            maxLength={12}
            required
          />
        </Field>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAmount(centsToPesosInput(balanceCents))}
            className="h-9 flex-1 rounded-lg border border-line-strong text-[13px] font-medium transition-colors hover:border-ink/25"
          >
            Todo el saldo
          </button>
          <button
            type="button"
            onClick={() => setAmount(centsToPesosInput(Math.round(balanceCents / 2)))}
            className="h-9 flex-1 rounded-lg border border-line-strong text-[13px] font-medium transition-colors hover:border-ink/25"
          >
            La mitad
          </button>
        </div>

        <Field label="Cómo te paga">
          <Select name="method" defaultValue="efectivo">
            {PAYMENT_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Nota">
          <Input name="note" placeholder="Opcional" maxLength={200} />
        </Field>
      </div>

      {state.error && (
        <div className="mt-4">
          <ErrorNote>{state.error}</ErrorNote>
        </div>
      )}

      <Button type="submit" disabled={pending} className="mt-5 w-full">
        {pending ? "Guardando…" : "Registrar abono"}
      </Button>

      {reminder && (
        <a
          href={reminder}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-line-strong text-[14px] font-medium transition-colors hover:border-ink/25"
        >
          <MessageCircle size={15} strokeWidth={1.9} className="text-[#25D366]" />
          Recordarle por WhatsApp
        </a>
      )}
    </form>
  );
}

/**
 * Cancelar. Va aparte y en tono discreto: es lo correcto cuando un apartado no
 * se concreta —las piezas tienen que volver al inventario— pero no es algo que
 * deba invitar a nadie a tocarlo por accidente.
 */
export function CancelSaleButton({
  saleId,
  hasPayments,
}: {
  saleId: number;
  hasPayments: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const warning = hasPayments
          ? "¿Cancelar esta venta? Las piezas vuelven a tu inventario. Los abonos que ya te dejó quedan registrados: lo que hagas con ese dinero lo acuerdas tú con tu clienta."
          : "¿Cancelar esta venta? Las piezas vuelven a tu inventario.";
        if (!confirm(warning)) return;

        startTransition(async () => {
          const result = await cancelSaleAction(saleId);
          toast(result.error ?? result.message ?? "Listo", result.error ? "error" : undefined);
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-1.5 text-[13px] text-mute transition-colors hover:text-red-600 disabled:opacity-40"
    >
      <Ban size={14} strokeWidth={1.8} />
      {pending ? "Cancelando…" : "Cancelar esta venta"}
    </button>
  );
}
