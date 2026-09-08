"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { joinClubAction, type ClubState } from "@/app/[seller]/club/actions";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

/**
 * Entrar al club.
 *
 * Tres campos y ninguna contraseña. Es el mismo formulario para quien se
 * registra por primera vez y para quien vuelve desde otro telefono: la clienta
 * no tiene forma de saber si su distribuidora ya la dio de alta al registrarle
 * una venta, asi que preguntarselo seria pedirle que adivine.
 */
export function ClubJoinForm({
  slug,
  businessName,
  terms,
}: {
  slug: string;
  businessName: string;
  terms: string | null;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ClubState, FormData>(joinClubAction, {
    ok: false,
  });

  // Al entrar, la pagina se vuelve a pintar del lado del servidor y aparece la
  // tarjeta con los puntos: la sesion vive en una cookie que este componente
  // no puede leer.
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  return (
    <form action={action} className="animate-fade-up mt-10">
      <input type="hidden" name="slug" value={slug} />

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <p className="text-[15px] font-medium">Entra al club</p>
        <p className="mt-1 text-[13px] leading-relaxed text-mute">
          Si ya le has comprado a {businessName.split(" ")[0]}, usa los mismos datos y recuperas
          los puntos que ya tenías.
        </p>

        <div className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <Input
                name="firstName"
                placeholder="Ana"
                required
                maxLength={40}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Apellido">
              <Input
                name="lastName"
                placeholder="Ramírez"
                required
                maxLength={60}
                autoComplete="family-name"
              />
            </Field>
          </div>

          <Field label="Teléfono" hint="Es tu identificación: con él te reconocemos siempre.">
            <Input
              name="phone"
              placeholder="656 123 4567"
              required
              inputMode="tel"
              maxLength={20}
              autoComplete="tel"
            />
          </Field>
        </div>

        {state.error && <div className="mt-4">
          <ErrorNote>{state.error}</ErrorNote>
        </div>}

        <Button type="submit" size="lg" disabled={pending} className="mt-5 w-full">
          {pending ? "Un momento…" : "Ver mis puntos"}
          {!pending && <ArrowRight size={17} strokeWidth={1.9} />}
        </Button>

        <p className="mt-3 text-[11px] leading-relaxed text-mute">
          Tus datos los usa únicamente {businessName} para llevar tus puntos y avisarte de tus
          recompensas. No se comparten con otras distribuidoras. Al continuar aceptas el{" "}
          <a href="/privacidad" target="_blank" className="underline underline-offset-2">
            aviso de privacidad
          </a>
          .
        </p>
      </div>

      {terms && (
        <p className="mt-4 whitespace-pre-line px-1 text-[12px] leading-relaxed text-mute">
          {terms}
        </p>
      )}
    </form>
  );
}
