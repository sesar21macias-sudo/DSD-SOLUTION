import { formatMoney, shortDate } from "@/lib/format";

/**
 * Graficas dibujadas a mano en SVG.
 *
 * No se usa una libreria porque estas dos formas —una linea de ingresos y unas
 * barras de ranking— son treinta lineas de codigo, y el Worker tiene un limite
 * de tamaño que conviene gastar en la tienda, no en un motor de graficas que
 * ademas obligaria a mandar todo al cliente.
 */

export function RevenueChart({
  data,
  height = 140,
}: {
  data: { day: string; cents: number }[];
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div
        className="grid place-items-center rounded-xl border border-dashed border-line-strong text-[13px] text-mute"
        style={{ height }}
      >
        Todavía no hay ventas en este periodo
      </div>
    );
  }

  // Un solo punto no dibuja una linea: se muestra como cifra y ya.
  if (data.length === 1) {
    return (
      <div
        className="grid place-items-center rounded-xl bg-canvas text-center"
        style={{ height }}
      >
        <div>
          <p className="text-[22px] font-medium tabular-nums">{formatMoney(data[0].cents)}</p>
          <p className="mt-1 text-[12px] text-mute">{shortDate(data[0].day)}</p>
        </div>
      </div>
    );
  }

  const W = 600;
  const H = height;
  const PAD = 6;
  const max = Math.max(...data.map((d) => d.cents), 1);

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - (d.cents / max) * (H - PAD * 2);
    return { x, y, ...d };
  });

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1].x.toFixed(1)},${H} L${points[0].x.toFixed(1)},${H} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Ingresos por día, máximo ${formatMoney(max)}`}
      >
        <defs>
          <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0a0b" stopOpacity="0.10" />
            <stop offset="100%" stopColor="#0a0a0b" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#rev-fill)" />
        <path
          d={line}
          fill="none"
          stroke="#0a0a0b"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p) => (
          <circle key={p.day} cx={p.x} cy={p.y} r="2.5" fill="#0a0a0b" />
        ))}
      </svg>

      <div className="mt-2 flex justify-between text-[11px] text-mute">
        <span>{shortDate(data[0].day)}</span>
        <span className="tabular-nums">Máx. {formatMoney(max)}</span>
        <span>{shortDate(data[data.length - 1].day)}</span>
      </div>
    </div>
  );
}

/** Ranking horizontal: se lee de un vistazo y aguanta nombres largos. */
export function RankBars({
  rows,
}: {
  rows: { label: string; sub?: string; value: number; display: string }[];
}) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-[13px] text-mute">Sin datos todavía</p>;
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] font-medium">
              {r.label}
              {r.sub && <span className="ml-1.5 text-[11px] font-normal text-mute">{r.sub}</span>}
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-ink-soft">{r.display}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(4, (r.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Tarjeta de cifra grande. */
export function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-card ${
        accent ? "border-ink bg-ink text-white" : "border-line bg-surface"
      }`}
    >
      <p className={`text-[12px] ${accent ? "text-white/60" : "text-mute"}`}>{label}</p>
      <p className="mt-1.5 text-[24px] font-medium leading-none tabular-nums">{value}</p>
      {hint && (
        <p className={`mt-1.5 text-[11px] ${accent ? "text-white/50" : "text-mute"}`}>{hint}</p>
      )}
    </div>
  );
}
