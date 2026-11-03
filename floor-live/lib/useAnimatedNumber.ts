"use client";

import { useEffect, useRef, useState } from "react";

const EASE_OUT_EXPO = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * Interpola hacia `value`. La animación es un adorno, nunca la fuente del dato:
 * requestAnimationFrame no corre en pestañas ocultas ni en renderers headless,
 * así que un temporizador de respaldo garantiza que el número final siempre
 * llegue al DOM. Respeta prefers-reduced-motion saltando al valor.
 */
export function useAnimatedNumber(value: number, duration = 520): number {
  const [display, setDisplay] = useState(value);
  const from = useRef(value);
  const raf = useRef<number | null>(null);
  const fallback = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const origin = from.current;
    if (origin === value) return;

    const skip =
      duration === 0 ||
      typeof document === "undefined" ||
      document.hidden ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const settle = () => {
      from.current = value;
      setDisplay(value);
    };

    if (skip) {
      settle();
      return;
    }

    const start = performance.now();
    const delta = value - origin;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      if (t >= 1) {
        settle();
        return;
      }
      const next = origin + delta * EASE_OUT_EXPO(t);
      // from.current sigue al valor mostrado: si el destino cambia a media
      // animación, la siguiente arranca donde el ojo la dejó, sin brincos.
      from.current = next;
      setDisplay(next);
      raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    // Red de seguridad: si los frames nunca llegan, el valor real igual aterriza.
    fallback.current = setTimeout(settle, duration + 120);

    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      if (fallback.current !== null) clearTimeout(fallback.current);
    };
  }, [value, duration]);

  return display;
}

export function fmt(n: number): string {
  return Math.round(n).toLocaleString("es-MX");
}
