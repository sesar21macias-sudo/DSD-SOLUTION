"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, MessageCircle } from "lucide-react";
import { createSellerAccount, type NewSellerResult } from "@/app/admin/sellers/actions";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { slugify } from "@/lib/format";

/**
 * El alta ahora la hace el admin, con datos mínimos: nombre, tienda, correo,
 * WhatsApp. La contraseña la genera el sistema — no se escribe aquí — y se
 * muestra una sola vez al terminar, lista para copiar o mandar por WhatsApp.
 */
export function NewSellerForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<NewSellerResult | null>(null);
  const [copied, setCopied] = useState(false);

  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      const res = await createSellerAccount({
        name: String(form.get("name") ?? ""),
        businessName: String(form.get("businessName") ?? ""),
        email: String(form.get("email") ?? ""),
        whatsapp: String(form.get("whatsapp") ?? ""),
        city: String(form.get("city") ?? ""),
        slug,
        planPriceCents: Math.round(Number(form.get("planPrice") ?? 0) * 100),
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setResult(res);
    });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // El texto sigue visible aunque no haya portapapeles.
    }
  }

  if (result?.ok) {
    const message = `Hola 👋 Aquí están tus datos para entrar a tu tienda:\n\nCorreo: ${result.email}\nContraseña: ${result.password}\n\nEntra en: https://midsd.org/login\n\nTe recomiendo cambiar la contraseña en cuanto entres, desde Configuración.`;
    const copyText = `Correo: ${result.email}\nContraseña: ${result.password}`;

    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <p className="text-[14px] font-medium text-emerald-800">
          Cuenta creada — /{result.slug}
        </p>
        <p className="mt-1 text-[12px] text-emerald-700">
          Guarda esto ahora: no se vuelve a mostrar. Si se pierde, hay que dar de alta otra vez.
        </p>

        <div className="mt-3 space-y-1 rounded-lg bg-white px-3 py-2.5 text-[13px]">
          <p>
            <span className="text-mute">Correo:</span> <span className="font-medium">{result.email}</span>
          </p>
          <p>
            <span className="text-mute">Contraseña:</span>{" "}
            <span className="font-medium tabular-nums">{result.password}</span>
          </p>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={() => copy(copyText)}
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white text-[13px] font-medium text-emerald-800 transition-colors hover:border-emerald-400"
          >
            {copied ? <Check size={13} strokeWidth={2.4} /> : <Copy size={13} strokeWidth={1.9} />}
            {copied ? "Copiado" : "Copiar"}
          </button>
          <a
            href={`https://wa.me/${result.whatsapp}?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-[13px] font-medium text-white"
          >
            <MessageCircle size={13} strokeWidth={2.2} />
            Enviar por WhatsApp
          </a>
        </div>

        <button
          onClick={() => router.push("/admin/sellers")}
          className="mt-4 text-[13px] font-medium text-emerald-800 underline underline-offset-4"
        >
          Ver distribuidoras
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Su nombre">
        <Input
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="Ana García"
          required
          maxLength={80}
        />
      </Field>

      <Field label="Nombre de su tienda">
        <Input name="businessName" placeholder="Ana García" maxLength={80} />
      </Field>

      <Field
        label="Enlace de su tienda"
        hint={slug ? `Entrará por /${slug}` : "Solo letras, números y guiones."}
      >
        <div className="flex items-center overflow-hidden rounded-xl border border-line-strong bg-surface focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/5">
          <span className="pl-3.5 text-[15px] text-mute-soft">/</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            placeholder="ana"
            minLength={3}
            maxLength={40}
            autoCapitalize="none"
            autoCorrect="off"
            className="w-full bg-transparent py-2.5 pl-0.5 pr-3.5 text-[15px] placeholder:text-mute-soft focus:outline-none"
          />
        </div>
      </Field>

      <Field label="Su WhatsApp" hint="Aquí le mandas sus credenciales.">
        <Input name="whatsapp" placeholder="656 123 4567" inputMode="tel" required maxLength={20} />
      </Field>

      <Field label="Su correo" hint="Con esto entra a su panel.">
        <Input name="email" type="email" placeholder="ana@correo.com" required maxLength={160} />
      </Field>

      <Field label="Ciudad">
        <Input name="city" placeholder="Ciudad Juárez, Chihuahua" maxLength={80} />
      </Field>

      <Field label="Lo que te va a pagar al mes (opcional)" hint="Puedes ajustarlo después.">
        <Input name="planPrice" type="number" min={0} step={1} placeholder="0" inputMode="decimal" />
      </Field>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Button type="submit" size="lg" disabled={pending} className="w-full">
        {pending ? "Creando…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
