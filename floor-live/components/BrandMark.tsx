/**
 * El logo de Beaufort reconstruido en vectores, para poder animarlo.
 *
 * La "o" son tres anillos partidos en dos; cada mitad arranca gruesa y se
 * adelgaza (como una pincelada). Las medidas salen del logo original de
 * 2000×383 px: centro (1479, 258), radio 126. Las letras son la imagen del
 * logo con la "o" borrada (public/brand/beaufort-word.png), en el mismo espacio,
 * así que todo encaja exacto.
 */

export const MARK = { cx: 1479, cy: 258, r: 126 };

interface Ring {
  id: "outer" | "middle" | "inner";
  color: string;
  /** Radio exterior y grosor (inicio → final de cada mitad), en fracciones de r. */
  outer: number;
  thick: [number, number];
  /** Dónde arranca y termina cada mitad, en grados (0 = derecha, 90 = abajo). */
  halves: [number, number][];
}

const RINGS: Ring[] = [
  { id: "outer", color: "#88d0e4", outer: 1.0, thick: [0.18, 0.07], halves: [[290, 463], [110, 283]] },
  { id: "middle", color: "#687870", outer: 0.73, thick: [0.18, 0.06], halves: [[295, 459], [112, 279]] },
  { id: "inner", color: "#28a8e0", outer: 0.45, thick: [0.15, 0.05], halves: [[307, 449], [121, 269]] },
];

/** Mitad de anillo como figura rellena: borde exterior circular, borde interior que se adelgaza. */
function crescent(ring: Ring, [a0, a1]: [number, number]): string {
  const { cx, cy, r } = MARK;
  const steps = 40;
  const pt = (deg: number, rad: number) => {
    const t = (deg * Math.PI) / 180;
    return `${(cx + Math.cos(t) * rad * r).toFixed(1)} ${(cy + Math.sin(t) * rad * r).toFixed(1)}`;
  };
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    // La punta final se cierra suave (ease-out) en lugar de recto.
    const w = ring.thick[0] + (ring.thick[1] - ring.thick[0]) * (1 - Math.pow(1 - k, 1.6));
    const deg = a0 + (a1 - a0) * k;
    outer.push(pt(deg, ring.outer));
    inner.push(pt(deg, ring.outer - w));
  }
  return `M${outer.join(" L")} L${inner.reverse().join(" L")} Z`;
}

const PATHS = RINGS.map((ring) => ({ ring, d: ring.halves.map((h) => crescent(ring, h)) }));

/** Para animar: cada anillo con su radio medio y ancho de banda (en px del logo). */
export const RING_PATHS = PATHS.map(({ ring, d }) => ({
  id: ring.id,
  color: ring.color,
  d,
  mid: (ring.outer - ring.thick[0] / 2) * MARK.r,
  band: ring.thick[0] * MARK.r,
}));

/** Los anillos solos (para el ícono del panel o el logo estático). */
export function BeaufortRings({ className, animate = false }: { className?: string; animate?: boolean }) {
  return (
    <>
      {PATHS.map(({ ring, d }, k) => (
        <g key={ring.id} className={animate ? `brand-ring brand-ring-${ring.id}` : undefined} style={{ "--k": k } as React.CSSProperties}>
          {d.map((p, j) => (
            <path key={j} d={p} fill={ring.color} className={className} />
          ))}
        </g>
      ))}
    </>
  );
}

/** Logo completo estático (letras + anillos) para encabezados. */
export function BeaufortLogo({ className, style, title = "Beaufort" }: { className?: string; style?: React.CSSProperties; title?: string }) {
  return (
    <svg viewBox="0 0 2000 383" className={className} style={style} role="img" aria-label={title}>
      <image href="/brand/beaufort-word.png" width="2000" height="383" />
      <BeaufortRings />
    </svg>
  );
}
