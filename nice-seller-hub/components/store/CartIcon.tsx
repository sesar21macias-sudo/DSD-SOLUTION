"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";

/**
 * El acceso al carrito, siempre visible en la cabecera. El contador da un
 * brinco cuando cambia: es la unica confirmacion que ve alguien que agrego una
 * pieza desde la rejilla sin abrir el detalle.
 */
export function CartIcon({ slug }: { slug: string }) {
  const { count, ready } = useCart();
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (!ready || count === 0) return;
    setPop(true);
    const t = setTimeout(() => setPop(false), 420);
    return () => clearTimeout(t);
  }, [count, ready]);

  return (
    <Link
      href={`/${slug}/cart`}
      className="relative grid h-9 w-9 place-items-center rounded-full text-ink transition-colors hover:bg-line/60"
      aria-label={count > 0 ? `Carrito, ${count} piezas` : "Carrito vacío"}
    >
      <ShoppingBag size={18} strokeWidth={1.7} />
      {ready && count > 0 && (
        <span
          className={`absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-nice px-1 text-[10px] font-semibold tabular-nums text-white ${
            pop ? "animate-pop" : ""
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
