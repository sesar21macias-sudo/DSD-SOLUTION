import { MARK, RING_PATHS } from "../BrandMark";

/*
 * Intro de marca para la tele (motion graphic). Se ve una vez por vuelta de
 * láminas, así que puede ser expresiva; la coreografía dura ~3.5 s y luego
 * se queda quieta (nada en bucle):
 *   0.15 s  los tres anillos se trazan en el centro, girando en sentidos
 *           opuestos hasta "encajar" (como un mecanismo);
 *   1.5 s   la "o" (2.3× más grande) viaja a su lugar dentro de la palabra;
 *   1.7 s   las letras se abren desde la "o" hacia los lados, de borroso a nítido;
 *   2.6 s   un destello cruza el logo una sola vez y entra "Beaufort Texas".
 * Con prefers-reduced-motion se muestra el logo final sin movimiento (brand.css).
 */
export function BrandMotion({ line, sub }: { line: string; sub: string }) {
  const { cx, cy } = MARK;
  return (
    <div className="brand-stage">
      <div className="brand-halo" aria-hidden="true" />
      <div className="brand-logo">
        <svg viewBox="0 0 2000 383" className="brand-svg" role="img" aria-label="Beaufort">
          <defs>
            {RING_PATHS.map((r, k) => (
              <mask key={r.id} id={`bm-${r.id}`} maskUnits="userSpaceOnUse" x="1300" y="80" width="360" height="360">
                <circle
                  cx={cx}
                  cy={cy}
                  r={r.mid}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={r.band + 24}
                  pathLength={1}
                  className="brand-draw"
                  style={{ "--k": k } as React.CSSProperties}
                />
              </mask>
            ))}
            <clipPath id="bm-left">
              <rect className="brand-wipe brand-wipe-l" x="0" y="0" width="1352" height="383" />
            </clipPath>
            <clipPath id="bm-right">
              <rect className="brand-wipe brand-wipe-r" x="1606" y="0" width="394" height="383" />
            </clipPath>
          </defs>

          <g className="brand-letters">
            <image href="/brand/beaufort-word.png" width="2000" height="383" clipPath="url(#bm-left)" />
            <image href="/brand/beaufort-word.png" width="2000" height="383" clipPath="url(#bm-right)" />
          </g>

          <g className="brand-mark">
            {RING_PATHS.map((r, k) => (
              <g key={r.id} className={`brand-ring brand-ring-${r.id}`} style={{ "--k": k } as React.CSSProperties}>
                <g mask={`url(#bm-${r.id})`}>
                  {r.d.map((p, j) => (
                    <path key={j} d={p} fill={r.color} />
                  ))}
                </g>
              </g>
            ))}
          </g>
        </svg>
        <div className="brand-shine" aria-hidden="true" />
      </div>

      <div className="brand-tag">
        <span className="brand-rule" aria-hidden="true" />
        <div className="brand-tag-row">
          <span className="brand-line">{line}</span>
        </div>
        <span className="brand-sub">{sub}</span>
      </div>
    </div>
  );
}
