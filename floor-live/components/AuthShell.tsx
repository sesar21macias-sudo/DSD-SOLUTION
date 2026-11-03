import { LanguageSwitch } from "./I18n";
import { Wordmark } from "./Shell";

/** Pantalla de entrada: una sola luz roja detrás del formulario. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[38%] h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, oklch(0.5 0.2 26 / 0.3), transparent 65%)" }}
      />
      <div className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))]">
        <LanguageSwitch />
      </div>
      <div className="rise relative w-full max-w-sm">
        <Wordmark className="mb-10" />
        <h1 className="font-display text-[2.75rem] leading-[1.02] tracking-[-0.015em]">{title}</h1>
        <p className="mb-8 mt-2 text-[0.9375rem] text-ink-soft">{subtitle}</p>
        {children}
      </div>
    </div>
  );
}
