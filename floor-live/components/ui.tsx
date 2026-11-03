/** Piezas visuales sin texto propio: sirven igual en servidor y cliente. */

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ name, size = 32, ring }: { name: string | null; size?: number; ring?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex flex-none items-center justify-center rounded-full bg-surface-3 font-semibold text-ink",
        ring && "ring-2 ring-red ring-offset-2 ring-offset-bg"
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {name ? initials(name) : "–"}
    </span>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="mx-auto mt-1.5 max-w-sm text-sm text-ink-faint">{children}</div>}
    </div>
  );
}
