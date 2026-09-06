"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { useCart, type CartItem } from "@/components/cart/CartProvider";
import { useToast } from "@/components/Toast";

/**
 * Agregar al carrito. La revision de existencias que se hace aqui es solo para
 * avisar a tiempo; la que cuenta corre en el servidor al generar el pedido.
 */

type Payload = Omit<CartItem, "quantity">;

/** Boton compacto para la rejilla: no saca a la persona del catalogo. */
export function AddButton({ item, disabled }: { item: Payload; disabled?: boolean }) {
  const { add } = useCart();
  const { toast } = useToast();
  const [justAdded, setJustAdded] = useState(false);

  function onClick(e: React.MouseEvent) {
    // La tarjeta completa es un enlace al detalle; este boton vive dentro.
    e.preventDefault();
    e.stopPropagation();

    const res = add(item);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    setJustAdded(true);
    toast("Agregado al carrito");
    setTimeout(() => setJustAdded(false), 1400);
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={`Agregar ${item.name} al carrito`}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full shadow-lift transition-all duration-300 disabled:opacity-30 ${
        justAdded
          ? "bg-emerald-500 text-white"
          : "bg-ink text-white hover:scale-105 active:scale-95"
      }`}
    >
      {justAdded ? <Check size={16} strokeWidth={2.4} /> : <Plus size={17} strokeWidth={2} />}
    </button>
  );
}

/** Version completa, con selector de cantidad, para el detalle del producto. */
export function AddToCartPanel({ item, buyable }: { item: Payload; buyable: boolean }) {
  const { add } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const max = Math.max(1, item.stock);

  function submit() {
    const res = add(item, quantity);
    if (!res.ok) {
      toast(res.message, "error");
      return;
    }
    setAdded(true);
    toast(`${quantity === 1 ? "Agregada" : `${quantity} agregadas`} al carrito`);
    setTimeout(() => setAdded(false), 1800);
  }

  if (!buyable) {
    return (
      <div className="rounded-2xl border border-line bg-canvas px-4 py-4 text-center">
        <p className="text-[14px] font-medium text-mute">Esta pieza está agotada</p>
        <p className="mt-1 text-[13px] text-mute-soft">
          Escríbele por WhatsApp para saber cuándo la vuelve a tener.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-14 shrink-0 items-center rounded-2xl border border-line-strong bg-surface">
        <button
          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          disabled={quantity <= 1}
          className="grid h-full w-11 place-items-center rounded-l-2xl text-ink-soft transition-colors hover:bg-line/50 disabled:opacity-25"
          aria-label="Quitar una"
        >
          <Minus size={15} strokeWidth={2} />
        </button>
        <span className="w-8 text-center text-[15px] font-medium tabular-nums">{quantity}</span>
        <button
          onClick={() => setQuantity((q) => Math.min(max, q + 1))}
          disabled={quantity >= max}
          className="grid h-full w-11 place-items-center rounded-r-2xl text-ink-soft transition-colors hover:bg-line/50 disabled:opacity-25"
          aria-label="Agregar una"
        >
          <Plus size={15} strokeWidth={2} />
        </button>
      </div>

      <button
        onClick={submit}
        className={`flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl text-[15px] font-medium text-white transition-all duration-300 active:scale-[0.98] ${
          added ? "bg-emerald-500" : "bg-ink hover:bg-ink-soft"
        }`}
      >
        {added ? (
          <>
            <Check size={17} strokeWidth={2.4} />
            Agregado
          </>
        ) : (
          "Agregar al carrito"
        )}
      </button>
    </div>
  );
}
