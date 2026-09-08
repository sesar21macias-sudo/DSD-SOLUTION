"use client";

import { useState } from "react";

/**
 * La galeria de la pieza. Una sola imagen no lleva miniaturas ni puntos: la
 * paginacion de un elemento solo estorba.
 *
 * El carrete se desliza con el dedo usando scroll-snap del navegador en vez de
 * una libreria de carrusel; es mas ligero y se siente nativo en iOS.
 */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="animate-fade grid aspect-square w-full place-items-center rounded-3xl border border-line bg-surface text-[12px] text-mute-soft">
        Sin foto
      </div>
    );
  }

  if (images.length === 1) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={images[0]}
        alt={alt}
        className="animate-fade aspect-square w-full rounded-3xl border border-line bg-surface object-cover"
      />
    );
  }

  return (
    <div className="animate-fade">
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-3xl"
        onScroll={(e) => {
          const el = e.currentTarget;
          setActive(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${i}`}
            src={src}
            alt={i === 0 ? alt : `${alt}, vista ${i + 1}`}
            loading={i === 0 ? "eager" : "lazy"}
            className="aspect-square w-full shrink-0 snap-center rounded-3xl border border-line bg-surface object-cover"
          />
        ))}
      </div>

      <div className="mt-3 flex justify-center gap-1.5">
        {images.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-5 bg-ink" : "w-1.5 bg-line-strong"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
