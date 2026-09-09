"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { saveInventoryItem, type ActionState } from "@/app/dashboard/actions";
import { centsToPesosInput, pesosToCents } from "@/lib/format";
import { costFromCatalog, marginPct, profitCents } from "@/lib/costing";
import { Button, ErrorNote, Field, Input, LinkButton } from "@/components/ui";
import { ImageUploadField } from "@/components/dashboard/ImageUploadField";
import { useToast } from "@/components/Toast";

/**
 * Editar una pieza del inventario. Solo se toca lo que es de esta
 * distribuidora —precio, existencias, visibilidad—; el nombre, la foto y el
 * material pertenecen al catalogo global y son los mismos para todas.
 */
export function EditInventoryForm({
  item,
  discountPct,
}: {
  item: {
    inventoryId: number;
    productId: number;
    niceCode: string;
    name: string;
    imageUrl: string | null;
    priceCents: number;
    costCents: number | null;
    catalogPriceCents: number | null;
    stock: number;
    isVisible: boolean;
  };
  /** Su descuento de distribuidora, para sugerir el costo. */
  discountPct: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveInventoryItem, {
    ok: false,
  });

  const [price, setPrice] = useState(centsToPesosInput(item.priceCents));
  const [cost, setCost] = useState(item.costCents !== null ? centsToPesosInput(item.costCents) : "");

  // La sugerencia solo aparece cuando hay de donde sacarla y ella no ha escrito
  // nada: proponerle un costo encima de uno que ya capturo seria discutirle.
  const suggested =
    item.catalogPriceCents && discountPct > 0
      ? costFromCatalog(item.catalogPriceCents, discountPct)
      : null;

  const priceCents = pesosToCents(price) ?? 0;
  const costCents = cost.trim() ? pesosToCents(cost) : null;
  const margin = marginPct(priceCents, costCents);
  const profit = profitCents(priceCents, costCents);

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      router.push("/dashboard/inventory");
    }
  }, [state, router, toast]);

  return (
    <form action={action} className="max-w-lg space-y-5">
      <input type="hidden" name="inventoryId" value={item.inventoryId} />
      <input type="hidden" name="productId" value={item.productId} />

      <Field
        label="Foto"
        hint="Es la foto del código NICE: si la cambias, se actualiza para cualquiera que también tenga esta pieza."
      >
        <ImageUploadField name="imageUrl" defaultValue={item.imageUrl ?? ""} />
      </Field>

      <Field
        label="Lo que te costó"
        hint={
          suggested !== null && !cost.trim()
            ? `Con tu ${discountPct}% de descuento serían $${centsToPesosInput(suggested)}.`
            : "Opcional. Es lo que hace que podamos calcular tu ganancia."
        }
      >
        <div className="flex gap-2">
          <Input
            name="cost"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="En pesos"
            inputMode="decimal"
            maxLength={12}
          />
          {suggested !== null && !cost.trim() && (
            <button
              type="button"
              onClick={() => setCost(centsToPesosInput(suggested))}
              className="h-[42px] shrink-0 rounded-xl border border-line-strong px-3 text-[13px] font-medium transition-colors hover:border-ink/25"
            >
              Usar
            </button>
          )}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Tu precio"
          hint={
            margin !== null && profit !== null
              ? `Ganas $${centsToPesosInput(profit)} por pieza · ${margin}% de margen`
              : "En pesos."
          }
        >
          <Input
            name="price"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            required
            maxLength={12}
          />
        </Field>
        <Field label="Cuántas tienes">
          <Input
            name="stock"
            type="number"
            min={0}
            max={9999}
            defaultValue={item.stock}
            required
            inputMode="numeric"
          />
        </Field>
      </div>

      <Field label="Motivo del ajuste" hint="Queda en tu historial de movimientos.">
        <Input name="reason" placeholder="Venta en persona, corrección, apartado…" maxLength={120} />
      </Field>

      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4">
        <input
          type="checkbox"
          name="isVisible"
          defaultChecked={item.isVisible}
          className="mt-0.5 h-4 w-4 accent-[#0a0a0b]"
        />
        <span>
          <span className="block text-[14px] font-medium">Mostrar en mi tienda</span>
          <span className="block text-[12px] leading-relaxed text-mute">
            Si la desmarcas, la pieza deja de aparecer en tu enlace público pero sigue en tu
            inventario.
          </span>
        </span>
      </label>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <div className="flex gap-2.5 pt-1">
        <Button type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <LinkButton href="/dashboard/inventory" size="lg" variant="secondary">
          Cancelar
        </LinkButton>
      </div>
    </form>
  );
}
