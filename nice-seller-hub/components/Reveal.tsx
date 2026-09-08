"use client";

import { useEffect, useRef, type ElementType, type ReactNode } from "react";

/**
 * Aparecer al llegar.
 *
 * Un IntersectionObserver y nada mas: sin librerias de animacion, sin escuchar
 * el scroll —que dispara decenas de veces por segundo y se nota en un telefono
 * de gama media— y sin volver a observar lo que ya entro.
 *
 * El estado invisible lo pone el CSS solo cuando hay JavaScript, asi que si
 * este componente nunca llega a correr el contenido se ve igual: hay que poder
 * leer una tienda aunque el script no cargue.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: ReactNode;
  /** Milisegundos de retraso, para escalonar hermanos. */
  delay?: number;
  as?: ElementType;
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Si ya esta a la vista al cargar —lo normal en la primera pantalla— se
    // muestra de inmediato en vez de esperar a que el observador reaccione.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      },
      // El margen negativo abajo lo dispara cuando el elemento ya entro de
      // verdad, no cuando asoma un pixel.
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
