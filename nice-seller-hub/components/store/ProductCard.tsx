import Link from "next/link";
import { STATUS_LABELS } from "@/lib/inventory";
import { formatMoney } from "@/lib/format";
import { codeToParam, sizeLabel } from "@/lib/nice-code";
import type { StoreProduct } from "@/lib/store";
import { AddButton } from "./AddToCart";

/**
 * La tarjeta de producto. La foto ocupa casi toda la tarjeta y siempre en
 * cuadrado: una rejilla donde cada imagen tiene una proporcion distinta se ve
 * desordenada por mas cuidado que se ponga en lo demas.
 */
export function ProductCard({ product, slug }: { product: StoreProduct; slug: string }) {
  const status = STATUS_LABELS[product.status];

  return (
    <li className="group relative">
      <Link
        href={`/${slug}/product/${codeToParam(product.niceCode)}`}
        className="block overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
      >
        <div className="relative aspect-square overflow-hidden bg-canvas">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.name}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <div className="grid h-full place-items-center px-3 text-center text-[11px] leading-snug text-mute-soft">
              {/* Sin foto se pone el codigo, que al menos identifica la pieza.
                  Antes decia "NICE" y le ponia una marca ajena a su tienda. */}
              {product.niceCode}
            </div>
          )}

          {product.status !== "available" && (
            <span className="absolute left-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-1 text-[10px] font-medium tracking-wide shadow-sm backdrop-blur">
              <span className={status.text}>{status.label}</span>
            </span>
          )}

          {/* Una pieza apartada se ve, pero apagada: sigue existiendo y puede
              volver en minutos, así que no se esconde ni se anuncia agotada. */}
          {product.status === "reserved" && (
            <span className="pointer-events-none absolute inset-0 bg-white/45" />
          )}

          {/* El boton flota sobre la foto en lugar de compartir renglon con el
              nombre: en un telefono a dos columnas, esos 36 px de ancho eran la
              diferencia entre leer "Pulsera de eslabón grueso" y "Pulsera de…". */}
          {status.buyable && (
            <div className="absolute bottom-2.5 right-2.5">
              <AddButton
                item={{
                  niceCode: product.niceCode,
                  name: product.name,
                  imageUrl: product.imageUrl,
                  priceCents: product.priceCents,
                  available: product.available,
                }}
              />
            </div>
          )}
        </div>

        <div className="p-3.5">
          <p className="line-clamp-2 text-[14px] font-medium leading-snug">{product.name}</p>
          <p className="mt-0.5 text-[11px] tabular-nums text-mute">
            {product.niceCode}
            {sizeLabel(product.niceCode) ? ` · ${sizeLabel(product.niceCode)}` : ""}
          </p>
          <p className="mt-1.5 text-[15px] font-medium tabular-nums">
            {formatMoney(product.priceCents)}
          </p>
        </div>
      </Link>
    </li>
  );
}
