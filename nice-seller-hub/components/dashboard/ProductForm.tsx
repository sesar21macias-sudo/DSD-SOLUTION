"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { createInventoryItem, type ActionState } from "@/app/dashboard/actions";
import { Button, ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Alta de una pieza.
 *
 * El codigo NICE va primero porque es lo que la distribuidora tiene enfrente,
 * impreso en la etiqueta. Si ese codigo ya existe en el catalogo global, el
 * servidor reutiliza la pieza y los datos descriptivos se ignoran: no puede
 * haber dos "826031" distintos en el sistema.
 */
export function ProductForm({ categories }: { categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(createInventoryItem, {
    ok: false,
  });
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      router.push("/dashboard/inventory");
    }
  }, [state, router, toast]);

  return (
    <form action={action} className="max-w-lg space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Código NICE" hint="El de la etiqueta.">
          <Input
            name="niceCode"
            placeholder="826031"
            required
            maxLength={20}
            autoCapitalize="characters"
            autoCorrect="off"
          />
        </Field>
        <Field label="Categoría">
          <Select name="categoryId" defaultValue="">
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Nombre de la pieza">
        <Input name="name" placeholder="Collar de eslabones" required maxLength={120} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tu precio" hint="En pesos.">
          <Input name="price" placeholder="1099" inputMode="decimal" required maxLength={12} />
        </Field>
        <Field label="Cuántas tienes">
          <Input
            name="stock"
            type="number"
            min={0}
            max={9999}
            defaultValue={1}
            required
            inputMode="numeric"
          />
        </Field>
      </div>

      <Field
        label="Foto"
        hint="Pega el enlace de la imagen. Se ve mejor en cuadrado."
      >
        <Input
          name="imageUrl"
          placeholder="https://…"
          inputMode="url"
          maxLength={500}
          onChange={(e) => setPreview(e.target.value.trim())}
        />
      </Field>

      {preview.startsWith("http") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Vista previa"
          className="h-32 w-32 rounded-2xl border border-line object-cover"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Material">
          <Input name="material" placeholder="Acero inoxidable" maxLength={60} />
        </Field>
        <Field label="Acabado">
          <Input name="finish" placeholder="Dorado" maxLength={60} />
        </Field>
      </div>

      <Field label="Descripción">
        <Textarea
          name="description"
          rows={3}
          maxLength={600}
          placeholder="Qué tiene de especial esta pieza."
        />
      </Field>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <div className="flex gap-2.5 pt-1">
        <Button type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Guardando…" : "Agregar a mi inventario"}
        </Button>
      </div>
    </form>
  );
}
