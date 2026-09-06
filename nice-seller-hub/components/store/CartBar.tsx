"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";

/**
 * Barra fija con el subtotal. Es lo que evita que alguien vaya agregando
 * piezas sin saber cuanto lleva, que es la razon numero uno por la que se
 * abandona un carrito en el telefono.
 *
 * Se esconde en el carrito y en el checkout: ahi el total ya esta en pantalla
 * y la barra solo taparia el boton de verdad.
 */
export function CartBar({ slug }: { slug: string }) {
  const { count, subtotalCents, ready } = useCart();
  const pathname = usePathname();

  const hidden =
    pathname.startsWith(`/${slug}/cart`) ||
    pathname.startsWith(`/${slug}/checkout`) ||
    pathname.startsWith(`/${slug}/order`);

  if (!ready || count === 0 || hidden) return null;

  return (
    <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
      <Link
        href={`/${slug}/cart`}
        className="animate-slide-up mx-auto flex h-14 max-w-md items-center gap-3 rounded-2xl bg-ink px-5 text-white shadow-lift transition-transform active:scale-[0.99]"
      >
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-white/15 px-1.5 text-[12px] font-semibold tabular-nums">
          {count}
        </span>
        <span className="text-[15px] font-medium">Ver mi pedido</span>
        <span className="ml-auto flex items-center gap-2 text-[15px] font-medium tabular-nums">
          {formatMoney(subtotalCents)}
          <ArrowRight size={16} strokeWidth={2} />
        </span>
      </Link>
    </div>
  );
}
