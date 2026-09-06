import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { formatMoney } from "@/lib/format";

/**
 * Los ladrillos de la interfaz. Todo lo demas se arma con esto para que dos
 * pantallas hechas en momentos distintos no acaben con dos botones distintos.
 */

// --- Botones ---------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "whatsapp";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink-soft active:scale-[0.98]",
  secondary:
    "bg-surface text-ink border border-line-strong hover:border-ink/30 hover:bg-white active:scale-[0.98]",
  ghost: "text-ink-soft hover:bg-line/60 active:scale-[0.98]",
  danger: "bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98]",
  whatsapp: "bg-[#25D366] text-white hover:bg-[#1eb457] active:scale-[0.98] shadow-card",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-xl",
  md: "h-11 px-5 text-[15px] rounded-xl",
  lg: "h-14 px-6 text-base rounded-2xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return [
    "inline-flex items-center justify-center gap-2 font-medium",
    "transition-all duration-200 ease-out",
    "disabled:opacity-40 disabled:pointer-events-none",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

// --- Contenedores ----------------------------------------------------------

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}
    >
      {children}
    </Tag>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-[17px] font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

// --- Datos -----------------------------------------------------------------

export function Money({
  cents,
  className = "",
}: {
  cents: number;
  className?: string;
}) {
  return <span className={`tnum ${className}`}>{formatMoney(cents)}</span>;
}

export function Badge({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ className }: { className: string }) {
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${className}`} />;
}

// --- Estados ---------------------------------------------------------------

/**
 * Nunca dejar una pantalla en blanco: un vacio sin explicacion se lee como
 * un error. Siempre dice que pasa y cual es el siguiente paso.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-16 text-center animate-fade">
      {icon && <div className="mb-4 text-mute-soft">{icon}</div>}
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-xs text-[13px] leading-relaxed text-mute">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

// --- Formularios -----------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12px] text-red-600">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] text-mute">{hint}</span>
      ) : null}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[15px] " +
  "placeholder:text-mute-soft transition-colors " +
  "focus:border-ink focus:outline-none focus:ring-4 focus:ring-ink/5";

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input {...props} className={`${inputClass} ${className}`} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea {...props} className={`${inputClass} resize-none ${className}`} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select {...props} className={`${inputClass} pr-8 ${className}`} />;
}

/** Aviso de error legible por una persona, nunca el mensaje tecnico. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-700 animate-fade">
      {children}
    </p>
  );
}
