"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { saveMessageTemplatesAction, type ActionState } from "@/app/dashboard/actions";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_MAX_LENGTH,
  TEMPLATE_META,
  type TemplateKey,
} from "@/lib/message-templates";
import { Button, ErrorNote, Field, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

/**
 * Los mensajes de WhatsApp, a su manera de escribir.
 *
 * Cada campo arranca mostrando lo que de verdad se manda hoy —lo suyo si ya lo
 * cambió, o el texto de siempre si no— para que edite desde ahí en vez de
 * adivinar qué dice el mensaje actual. El botón de restaurar regresa ese campo
 * al texto de siempre sin tocar los demás.
 *
 * Los renglones con precios, folio y totales del pedido no están aquí: esos
 * los arma el sistema siempre igual, porque son dinero y no redacción.
 */
export function MessageTemplatesForm({
  templates,
}: {
  templates: Record<TemplateKey, string | null>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, pending] = useActionState<ActionState, FormData>(
    saveMessageTemplatesAction,
    { ok: false }
  );

  const [values, setValues] = useState<Record<TemplateKey, string>>(() =>
    Object.fromEntries(
      (Object.keys(TEMPLATE_META) as TemplateKey[]).map((key) => [
        key,
        templates[key] ?? DEFAULT_TEMPLATES[key],
      ])
    ) as Record<TemplateKey, string>
  );

  useEffect(() => {
    if (state.ok && state.message) toast(state.message);
    if (state.error) toast(state.error, "error");
    if (state.ok) router.refresh();
  }, [state, router, toast]);

  return (
    <form action={action} className="max-w-lg space-y-6">
      {(Object.keys(TEMPLATE_META) as TemplateKey[]).map((key) => {
        const meta = TEMPLATE_META[key];
        const isDefault = values[key] === DEFAULT_TEMPLATES[key];

        return (
          <Field key={key} label={meta.title} hint={meta.hint}>
            <div className="relative">
              <Textarea
                name={key}
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                rows={meta.rows}
                maxLength={TEMPLATE_MAX_LENGTH}
                className="pr-10"
              />
              {!isDefault && (
                <button
                  type="button"
                  onClick={() => setValues((v) => ({ ...v, [key]: DEFAULT_TEMPLATES[key] }))}
                  className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-lg text-mute transition-colors hover:bg-line/60 hover:text-ink"
                  aria-label="Restaurar mensaje original"
                  title="Restaurar mensaje original"
                >
                  <RotateCcw size={14} strokeWidth={1.9} />
                </button>
              )}
            </div>

            {meta.placeholders.length > 0 && (
              <p className="mt-1.5 text-[12px] leading-relaxed text-mute">
                Puedes usar:{" "}
                {meta.placeholders.map((p, i) => (
                  <span key={p.token}>
                    <code className="rounded bg-canvas px-1 py-0.5 text-[11px]">
                      {"{" + p.token + "}"}
                    </code>{" "}
                    ({p.label}){i < meta.placeholders.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            )}
          </Field>
        );
      })}

      {state.error && <ErrorNote>{state.error}</ErrorNote>}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Guardando…" : "Guardar mensajes"}
      </Button>
    </form>
  );
}
