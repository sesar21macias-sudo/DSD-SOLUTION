"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";
import { dicts } from "@/lib/i18n/dict";
import { PLANT_TZ } from "@/lib/dates";
import { docLang, useDict } from "./I18n";

/** fetch con JSON que lanza el mensaje del servidor como Error. */
export async function send<T = { ok: boolean }>(url: string, method: string, data?: unknown): Promise<T> {
  const isForm = data instanceof FormData;
  const res = await fetch(url, {
    method,
    headers: data && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: data === undefined ? undefined : isForm ? data : JSON.stringify(data),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  const d = dicts[docLang()];
  if (res.status === 401) {
    window.location.href = "/entrar";
    throw new Error(json.error ?? d.net.sessionEnded);
  }
  if (!res.ok) throw new Error(json.error ?? d.net.saveFailed);
  return json;
}

/* ---------- Avisos ---------- */

type ToastMsg = { id: number; text: string; tone: "ok" | "error" };
let toasts: ToastMsg[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, tone: "ok" | "error" = "ok") {
  const id = Date.now() + Math.random();
  toasts = [...toasts, { id, text, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, tone === "error" ? 5200 : 2800);
}

export function Toaster() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => toasts
  );
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-24 flex flex-col items-center gap-2 px-4 md:bottom-8"
      style={{ zIndex: "var(--z-toast)" }}
      aria-live="polite"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`toast pointer-events-auto rounded-full px-4 py-2.5 text-sm font-medium shadow-[0_6px_8px_oklch(0_0_0/0.4)] ${
            t.tone === "error" ? "bg-red text-white" : "bg-ink text-bg"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------- Luz que sigue al cursor sobre los paneles .lit ---------- */

export function Spotlight() {
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const el = (e.target as Element | null)?.closest?.(".lit") as HTMLElement | null;
        if (!el) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);
  return null;
}

/* ---------- Números y tiempo ---------- */

export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  // Arranca en 0 para que el número cuente junto con la barra/anillo.
  const [target, setTarget] = useState(0);
  useEffect(() => setTarget(value), [value]);
  const shown = useAnimatedNumber(target, 1100);
  return <span className={className}>{Math.round(shown)}</span>;
}

function relative(iso: string, now: number, locale: string, justNow: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const diff = (Date.parse(iso) - now) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return justNow;
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 7) return rtf.format(Math.round(diff / 86400), "day");
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));
}

export function RelTime({ iso }: { iso: string }) {
  const d = useDict();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const full = new Intl.DateTimeFormat(d.locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  return (
    <time dateTime={iso} title={full} suppressHydrationWarning>
      {now === null ? full : relative(iso, now, d.locale, d.dates.justNow)}
    </time>
  );
}

/** Fecha y hora completas en el idioma activo y la zona del equipo ("14 oct 2026, 3:20 p.m."). */
export function FullDate({ iso }: { iso: string }) {
  const d = useDict();
  const text = new Intl.DateTimeFormat(d.locale, { dateStyle: "medium", timeStyle: "short", timeZone: PLANT_TZ }).format(new Date(iso));
  return <time dateTime={iso}>{text}</time>;
}

/** Vuelve a pedir los datos al regresar a la pestaña: el tablero siempre está al día. */
export function RefreshOnFocus({ every = 60_000 }: { every?: number }) {
  const router = useRouter();
  const last = useRef(Date.now());
  useEffect(() => {
    const refresh = () => {
      if (document.hidden || Date.now() - last.current < 15_000) return;
      last.current = Date.now();
      router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    const t = setInterval(refresh, every);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(t);
    };
  }, [every, router]);
  return null;
}
