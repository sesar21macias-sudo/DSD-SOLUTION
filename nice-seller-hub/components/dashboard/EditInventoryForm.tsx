"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { saveInventoryItem, type ActionState } from "@/app/dashboard/actions";
import { centsToPesosInput } from "@/lib/format";
import { Button, ErrorNote, Field, Input, LinkButton } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Editar una pieza del inventario. Solo se toca lo que es de esta
 * distribuidora —precio, existencias, visibilidad—; el nombre, la foto y el
 * material pertenecen al catalogo global y son los mismos para todas.
 */
export function EditInventoryForm({
  item,
}: {
  item: {
    inventoryId: number;
    niceCode: string;
    name: string;
    imageUrl: string | null;
    priceCents: number;
    stock: number;
    isVisible: boolean;
  };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveInventoryItem, {
    ok: false,
  });

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      router.push("/dashboard/inventory");
    }
  }, [state, router, toast]);

  return (
    <form action={action} className="max-w-lg space-y-5">
      <input type="hidden" name="inventoryId" value={item.inventoryId} />

      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="h-28 w-28 rounded-2xl border border-line object-cover"
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tu precio" hint="En pesos.">
          <Input
            name="price"
            defaultValue={centsToPesosInput(item.priceCents)}
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
