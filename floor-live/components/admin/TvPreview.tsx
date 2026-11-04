"use client";

/**
 * La lámina real de la tele, a escala dentro del panel. Con `onPick`, tocar la
 * vista previa devuelve el punto (0-100 %) para el enfoque de una foto.
 */
export function TvPreview({
  children,
  onPick,
  dot,
  label,
}: {
  children: React.ReactNode;
  onPick?: (x: number, y: number) => void;
  dot?: { x: number; y: number } | null;
  label?: string;
}) {
  return (
    <div
      className="tv-preview"
      data-pick={onPick ? "true" : undefined}
      role={onPick ? "button" : undefined}
      aria-label={label}
      onClick={
        onPick
          ? (e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const x = Math.round(((e.clientX - r.left) / r.width) * 100);
              const y = Math.round(((e.clientY - r.top) / r.height) * 100);
              onPick(Math.max(0, Math.min(100, x)), Math.max(0, Math.min(100, y)));
            }
          : undefined
      }
    >
      <div className="tv-preview-u">
        <div className="slide">{children}</div>
      </div>
      {dot && <span className="tv-preview-dot" style={{ left: `${dot.x}%`, top: `${dot.y}%` }} aria-hidden="true" />}
    </div>
  );
}
