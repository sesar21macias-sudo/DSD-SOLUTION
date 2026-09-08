"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { slugify } from "@/lib/format";

/**
 * Entrar y darse de alta. El alta pide lo minimo para que la tienda ya sirva:
 * nombre, correo, contraseña, WhatsApp y el enlace. Todo lo demas —foto,
 * descripcion, horarios— se llena despues, desde Configuración.
 */
export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const form = new FormData(e.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; role?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "No pudimos completar la operación.");
        setBusy(false);
        return;
      }

      const back = params.get("volver");
      const target = data.role === "admin" ? "/admin" : back || "/dashboard";
      // `refresh` obliga a volver a pedir los componentes de servidor con la
      // cookie nueva; sin esto el panel se renderizaria todavia sin sesion.
      router.replace(target);
      router.refresh();
    } catch {
      setError("No pudimos conectar. Revisa tu señal.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "register" && (
        <>
          <Field label="Tu nombre">
            <Input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Ana García"
              autoComplete="name"
              required
              maxLength={80}
            />
          </Field>

          <Field
            label="El enlace de tu tienda"
            hint={slug ? `Tus clientes entrarán a /${slug}` : "Solo letras, números y guiones."}
          >
            <div className="flex items-center overflow-hidden rounded-xl border border-line-strong bg-surface focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5">
              <span className="pl-3.5 text-[15px] text-mute-soft">/</span>
              <input
                name="slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="ana"
                required
                minLength={3}
                maxLength={40}
                autoCapitalize="none"
                autoCorrect="off"
                className="w-full bg-transparent py-2.5 pl-0.5 pr-3.5 text-[15px] placeholder:text-mute-soft focus:outline-none"
              />
            </div>
          </Field>

          <Field label="Nombre de tu tienda" hint="Es lo que ven tus clientes arriba de todo.">
            <Input
              name="businessName"
              placeholder="Ana García"
              defaultValue=""
              maxLength={80}
            />
          </Field>

          <Field label="Tu WhatsApp" hint="Es a donde llegan los pedidos.">
            <Input
              name="whatsapp"
              placeholder="656 123 4567"
              inputMode="tel"
              autoComplete="tel"
              required
              maxLength={20}
            />
          </Field>

          <Field label="Ciudad">
            <Input name="city" placeholder="Ciudad Juárez, Chihuahua" maxLength={80} />
          </Field>
        </>
      )}

      <Field label="Correo">
        <Input
          name="email"
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          autoCapitalize="none"
          required
          maxLength={160}
        />
      </Field>

      <Field
        label="Contraseña"
        hint={mode === "register" ? "Mínimo 8 caracteres." : undefined}
      >
        <Input
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          required
          minLength={mode === "register" ? 8 : 1}
        />
      </Field>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy
          ? "Un momento…"
          : mode === "register"
            ? "Crear mi tienda"
            : "Entrar"}
      </Button>

      {mode === "register" ? (
        // El consentimiento va junto al boton que lo otorga, no escondido en el
        // pie: es donde de verdad se lee.
        <p className="text-center text-[12px] leading-relaxed text-mute">
          Al crear tu tienda aceptas los{" "}
          <a href="/terminos" target="_blank" className="underline underline-offset-2">
            términos
          </a>{" "}
          y el{" "}
          <a href="/privacidad" target="_blank" className="underline underline-offset-2">
            aviso de privacidad
          </a>
          .
        </p>
      ) : (
        <p className="text-center text-[12px] leading-relaxed text-mute">
          ¿Olvidaste tu contraseña? Escríbele a quien administra la plataforma y te manda un
          enlace para cambiarla.
        </p>
      )}
    </form>
  );
}
