"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import { EmptyState, LinkButton } from "@/components/ui";

/**
 * El carrito. Muestra el subtotal de cada partida ya multiplicado: el error
 * mas comun al revisar un pedido es leer el precio unitario como si fuera el
 * total de esa linea.
 */
export function CartView({ slug, businessName }: { slug: string; businessName: string }) {
  const { items, count, subtotalCents, setQuantity, remove, ready } = useCart();

  if (!ready) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <div className="skeleton h-24 rounded-2xl" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <h1 className="mb-6 text-[26px] font-light">Mi pedido</h1>
        <EmptyState
          icon={<ShoppingBag size={30} strokeWidth={1.3} />}
          title="Tu pedido está vacío"
          description={`Agrega las piezas que quieras de la tienda de ${businessName} y aquí las revisas antes de mandarlas.`}
          action={
            <LinkButton href={`/${slug}`} variant="secondary">
              Ver las piezas
            </LinkButton>
          }
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-[26px] font-light">Mi pedido</h1>
      <p className="mt-1 text-[13px] text-mute">
        {count} {count === 1 ? "pieza" : "piezas"} de {businessName}
      </p>

      <ul className="stagger mt-6 space-y-3">
        {items.map((item) => {
          const lineTotal = item.priceCents * item.quantity;
          const atMax = item.quantity >= item.stock;

          return (
            <li
              key={item.niceCode}
              className="flex gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card"
            >
              <Link
                href={`/${slug}/product/${item.niceCode}`}
                className="shrink-0 overflow-hidden rounded-xl bg-canvas"
              >
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="h-20 w-20 object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid h-20 w-20 place-items-center text-[10px] tracking-[0.2em] text-mute-soft">
                    NICE
                  </span>
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/${slug}/product/${item.niceCode}`}
                      className="line-clamp-2 text-[14px] font-medium leading-snug"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-[11px] tabular-nums text-mute">{item.niceCode}</p>
                  </div>
                  <button
                    onClick={() => remove(item.niceCode)}
                    className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-mute-soft transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label={`Quitar ${item.name}`}
                  >
                    <Trash2 size={15} strokeWidth={1.7} />
                  </button>
                </div>

                <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                  <div className="flex h-9 items-center rounded-xl border border-line-strong">
                    <button
                      onClick={() => setQuantity(item.niceCode, item.quantity - 1)}
                      className="grid h-full w-8 place-items-center rounded-l-xl text-ink-soft transition-colors hover:bg-line/50"
                      aria-label="Quitar una"
                    >
                      <Minus size={13} strokeWidth={2.2} />
                    </button>
                    <span className="w-7 text-center text-[14px] font-medium tabular-nums">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => setQuantity(item.niceCode, item.quantity + 1)}
                      disabled={atMax}
                      className="grid h-full w-8 place-items-center rounded-r-xl text-ink-soft transition-colors hover:bg-line/50 disabled:opacity-25"
                      aria-label="Agregar una"
                    >
                      <Plus size={13} strokeWidth={2.2} />
                    </button>
                  </div>

                  <div className="text-right">
                    {item.quantity > 1 && (
                      <p className="text-[11px] tabular-nums text-mute">
                        {formatMoney(item.priceCents)} c/u
                      </p>
                    )}
                    <p className="text-[15px] font-medium tabular-nums">
                      {formatMoney(lineTotal)}
                    </p>
                  </div>
                </div>

                {atMax && (
                  <p className="mt-1.5 text-[11px] text-amber-700">
                    {item.stock === 1
                      ? "Es la última pieza disponible."
                      : `Es todo lo que hay (${item.stock}).`}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <div className="flex items-baseline justify-between text-[14px] text-mute">
          <span>Piezas</span>
          <span className="tabular-nums">{count}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between text-[14px] text-mute">
          <span>Subtotal</span>
          <span className="tabular-nums">{formatMoney(subtotalCents)}</span>
        </div>
        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-[15px] font-medium">Total</span>
          <span className="text-[22px] font-medium tabular-nums">
            {formatMoney(subtotalCents)}
            <span className="ml-1 text-[12px] font-normal text-mute">MXN</span>
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        <LinkButton href={`/${slug}/checkout`} size="lg">
          Continuar
        </LinkButton>
        <LinkButton href={`/${slug}`} variant="ghost" size="md">
          Seguir viendo piezas
        </LinkButton>
      </div>
    </main>
  );
}
