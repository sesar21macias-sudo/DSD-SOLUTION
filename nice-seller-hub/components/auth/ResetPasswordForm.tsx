"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

/**
 * Poner la contraseña nueva.
 *
 * Se piden dos veces. En un teclado de celular, con la contraseña oculta, un
 * dedazo se convierte en quedarse fuera otra vez — y pedir un segundo enlace.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña necesita al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las dos contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; redirect?: string };

      if (!res.ok || !data.ok) {
        setError(data.error ?? "No pudimos cambiar tu contraseña.");
        setBusy(false);
        return;
      }

      // El servidor ya dejo la sesion abierta: entra directo, sin volver a
      // escribir lo que acaba de escribir.
      router.push(data.redirect ?? "/dashboard");
      router.refresh();
    } catch {
      setError("No pudimos conectar. Revisa tu señal e intenta otra vez.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 space-y-4">
      <Field label="Contraseña nueva" hint="Mínimo 8 caracteres.">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
          autoFocus
        />
      </Field>

      <Field label="Repítela">
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      {error && <ErrorNote>{error}</ErrorNote>}

      <Button type="submit" size="lg" disabled={busy} className="w-full">
        {busy ? "Guardando…" : "Guardar y entrar"}
      </Button>
    </form>
  );
}
