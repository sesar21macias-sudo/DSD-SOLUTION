"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { createInventoryItem, type ActionState } from "@/app/dashboard/actions";
import { centsToPesosInput } from "@/lib/format";
import { Button, ErrorNote, Field, Input, Select, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Alta de una pieza.
 *
 * El codigo NICE va primero porque es lo que la distribuidora tiene enfrente,
 * impreso en la etiqueta — y porque al escribirlo se llena todo lo demas: el
 * nombre, la foto y el precio salen del catalogo de NICE. Escribir a mano el
 * nombre de una pieza y pegar el enlace de una foto es justo el trabajo que
 * esta funcion existe para quitar.
 *
 * Si ese codigo ya existe en el catalogo global, el servidor reutiliza la pieza
 * y los datos descriptivos se ignoran: no puede haber dos "826031" distintos.
 */

interface FoundProduct {
  niceCode: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  suggestedPriceCents: number | null;
  categoryId: number | null;
}

export function ProductForm({ categories }: { categories: { id: number; name: string }[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(createInventoryItem, {
    ok: false,
  });

  const [code, setCode] = useState("");
  const [found, setFound] = useState<FoundProduct | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [preview, setPreview] = useState("");

  // Cada búsqueda cancela la anterior: si alguien escribe rápido, la respuesta
  // de un código a medio teclear no debe pisar la del código completo.
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    if (state.ok && state.message) {
      toast(state.message);
      router.push("/dashboard/inventory");
    }
  }, [state, router, toast]);

  useEffect(() => {
    const clean = code.trim().toUpperCase();
    setLookupError(null);

    if (!/^[A-Z0-9-]{5,20}$/.test(clean)) {
      setFound(null);
      return;
    }

    // 450 ms: alcanza para terminar de teclear un código de siete caracteres
    // sin disparar una consulta por tecla.
    const t = setTimeout(async () => {
      inFlight.current?.abort();
      const ctrl = new AbortController();
      inFlight.current = ctrl;

      setLooking(true);
      try {
        const res = await fetch(
          `/api/dashboard/catalog/lookup?code=${encodeURIComponent(clean)}`,
          { signal: ctrl.signal }
        );
        const data = (await res.json()) as {
          ok?: boolean;
          product?: FoundProduct;
          error?: string;
        };

        if (!res.ok || !data.ok || !data.product) {
          setFound(null);
          setLookupError(data.error ?? "No encontramos ese código.");
          return;
        }
        setFound(data.product);
        setPreview(data.product.imageUrl ?? "");
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setFound(null);
          setLookupError("No pudimos consultar el catálogo.");
        }
      } finally {
        if (!ctrl.signal.aborted) setLooking(false);
      }
    }, 450);

    return () => clearTimeout(t);
  }, [code]);

  // `key` fuerza a React a rehacer los campos cuando llega una pieza nueva; sin
  // eso, defaultValue no se actualizaría sobre un input ya montado.
  const formKey = found?.niceCode ?? "vacio";

  return (
    <form action={action} className="max-w-lg space-y-5">
      <Field
        label="Código NICE"
        hint="El de la etiqueta. Al escribirlo buscamos la pieza en el catálogo."
      >
        <div className="relative">
          <Input
            name="niceCode"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="925094L"
            required
            maxLength={20}
            autoCapitalize="characters"
            autoCorrect="off"
            className="pr-10"
          />
          {looking && (
            <Loader2
              size={16}
              strokeWidth={2}
              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-mute"
            />
          )}
        </div>
      </Field>

      {found && (
        <div className="animate-fade-up flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
          {found.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={found.imageUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl bg-white object-cover"
            />
          ) : (
            <span className="h-16 w-16 shrink-0 rounded-xl bg-white" />
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800">
              <Sparkles size={11} strokeWidth={2.2} />
              Encontrada en el catálogo NICE
            </p>
            <p className="mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug">
              {found.name}
            </p>
            <p className="text-[11px] tabular-nums text-mute">{found.niceCode}</p>
          </div>
        </div>
      )}

      {lookupError && code.trim().length >= 5 && !looking && (
        <p className="-mt-2 text-[12px] text-mute">
          {lookupError} Puedes capturar los datos a mano.
        </p>
      )}

      <div key={formKey} className="space-y-5">
        <Field label="Nombre de la pieza">
          <Input
            name="name"
            defaultValue={found?.name ?? ""}
            placeholder="Collar de eslabones"
            required
            maxLength={120}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Tu precio"
            hint={
              found?.suggestedPriceCents
                ? `Catálogo: $${centsToPesosInput(found.suggestedPriceCents)}`
                : "En pesos."
            }
          >
            <Input
              name="price"
              defaultValue={
                found?.suggestedPriceCents ? centsToPesosInput(found.suggestedPriceCents) : ""
              }
              placeholder="1099"
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
              defaultValue={1}
              required
              inputMode="numeric"
            />
          </Field>
        </div>

        <Field label="Categoría">
          <Select name="categoryId" defaultValue={found?.categoryId ?? ""}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Foto" hint="Se llena sola si la pieza está en el catálogo NICE.">
          <Input
            name="imageUrl"
            defaultValue={found?.imageUrl ?? ""}
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

        <Field label="Descripción">
          <Textarea
            name="description"
            defaultValue={found?.description ?? ""}
            rows={3}
            maxLength={600}
            placeholder="Qué tiene de especial esta pieza."
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Material">
            <Input name="material" placeholder="Acero inoxidable" maxLength={60} />
          </Field>
          <Field label="Acabado">
            <Input name="finish" placeholder="Dorado" maxLength={60} />
          </Field>
        </div>
      </div>

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Guardando…" : "Agregar a mi inventario"}
      </Button>
    </form>
  );
}
