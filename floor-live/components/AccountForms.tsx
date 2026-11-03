"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { internalPath } from "@/lib/safe-path";
import { useDict } from "./I18n";
import { send, toast } from "./client";

export function LoginForm() {
  const params = useSearchParams();
  const d = useDict();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/entrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: f.get("username"), password: f.get("password") }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? d.auth.loginFailed);
      const back = params.get("volver");
      // Navegación completa, no router.replace + refresh: esos dos juntos compiten
      // y el refresh de /entrar puede cancelar la ida al panel (te deja en el login
      // aunque la sesión ya se creó). Una carga completa además estrena la cookie.
      window.location.assign(internalPath(back) ?? "/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="username">{d.auth.username}</label>
        <input id="username" name="username" className="field" autoComplete="username" autoCapitalize="none" autoCorrect="off" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">{d.auth.password}</label>
        <input id="password" name="password" type="password" className="field" autoComplete="current-password" required aria-invalid={!!error} />
      </div>
      {error && <p role="alert" className="text-sm text-red-text">{error}</p>}
      <button type="submit" className="btn btn-primary mt-2 h-12 text-[0.9375rem]" disabled={busy}>
        {busy ? d.auth.loggingIn : d.auth.login}
      </button>
    </form>
  );
}

export function SetupForm() {
  const d = useDict();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/inicio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? d.auth.setupFailed);
      window.location.assign("/");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="code">{d.auth.setupCode}</label>
        <input id="code" name="code" type="password" className="field" required autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="name">{d.auth.yourName}</label>
        <input id="name" name="name" className="field" required maxLength={60} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="username">{d.auth.username}</label>
        <input id="username" name="username" className="field font-mono" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" autoCapitalize="none" autoComplete="username" />
      </div>
      <div>
        <label className="label" htmlFor="password">{d.auth.password}</label>
        <input id="password" name="password" type="password" className="field" required minLength={8} autoComplete="new-password" />
        <p className="mt-1.5 text-xs text-ink-faint">{d.auth.minChars}</p>
      </div>
      {error && <p role="alert" className="text-sm text-red-text">{error}</p>}
      <button type="submit" className="btn btn-primary mt-2 h-12" disabled={busy}>
        {busy ? d.auth.creating : d.auth.createAdminButton}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const d = useDict();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("next") !== f.get("confirm")) {
      setError(d.account.mismatch);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await send("/api/cuenta", "PATCH", { current: f.get("current"), next: f.get("next") });
      toast(d.account.changed);
      form.reset();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div>
        <label className="label" htmlFor="current">{d.account.current}</label>
        <input id="current" name="current" type="password" className="field" required autoComplete="current-password" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="next">{d.account.new}</label>
          <input id="next" name="next" type="password" className="field" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">{d.account.repeat}</label>
          <input id="confirm" name="confirm" type="password" className="field" required minLength={8} autoComplete="new-password" />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-text">{error}</p>}
      <button type="submit" className="btn btn-light self-start" disabled={busy}>
        {busy ? d.common.saving : d.account.change}
      </button>
    </form>
  );
}

export function LogoutButton() {
  const d = useDict();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-danger"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/auth/salir", { method: "POST" }).catch(() => {});
        window.location.href = "/entrar";
      }}
    >
      {busy ? d.account.loggingOut : d.account.logout}
    </button>
  );
}
