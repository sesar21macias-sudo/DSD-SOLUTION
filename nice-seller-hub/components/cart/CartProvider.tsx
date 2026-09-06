"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * El carrito vive en el navegador y **esta separado por tienda**. La llave de
 * localStorage lleva el slug, asi que el carrito de Ana y el de María son dos
 * cosas distintas y no hay forma de mezclar piezas de dos distribuidoras en un
 * mismo pedido: cada pedido se le manda por WhatsApp a una sola persona.
 *
 * Lo que se guarda aqui es una conveniencia, no una verdad. El precio y las
 * existencias se vuelven a leer en el servidor antes de generar el pedido: un
 * carrito puede llevar dias abierto.
 */

export interface CartItem {
  niceCode: string;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  quantity: number;
  /** Existencias en el momento de agregar. Solo para avisar antes de tiempo. */
  stock: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  ready: boolean;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => AddResult;
  setQuantity: (niceCode: string, quantity: number) => void;
  remove: (niceCode: string) => void;
  clear: () => void;
}

export type AddResult = { ok: true; quantity: number } | { ok: false; message: string };

const CartContext = createContext<CartContextValue | null>(null);

const VERSION = "v1";
const storageKey = (slug: string) => `nsh_cart_${VERSION}:${slug}`;

function readStored(slug: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Se filtra lo que no tenga forma de partida: un localStorage editado a
    // mano no debe poder tumbar la tienda.
    return parsed.filter(
      (i): i is CartItem =>
        i &&
        typeof i.niceCode === "string" &&
        typeof i.priceCents === "number" &&
        typeof i.quantity === "number" &&
        i.quantity > 0
    );
  } catch {
    return [];
  }
}

export function CartProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  // `ready` evita que el contador parpadee de 0 al numero real: en el primer
  // render del servidor todavia no se puede leer localStorage.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(readStored(slug));
    setReady(true);
  }, [slug]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey(slug), JSON.stringify(items));
    } catch {
      // Modo privado o almacenamiento lleno: el carrito sigue funcionando en
      // memoria durante la visita, que es lo que importa.
    }
  }, [items, slug, ready]);

  const add = useCallback<CartContextValue["add"]>((item, quantity = 1) => {
    let result: AddResult = { ok: true, quantity };

    setItems((prev) => {
      const existing = prev.find((i) => i.niceCode === item.niceCode);
      const desired = (existing?.quantity ?? 0) + quantity;

      if (item.stock <= 0) {
        result = { ok: false, message: "Esta pieza está agotada." };
        return prev;
      }
      if (desired > item.stock) {
        result = {
          ok: false,
          message:
            item.stock === 1
              ? "Solo hay 1 pieza disponible."
              : `Solo hay ${item.stock} piezas disponibles.`,
        };
        // Se deja el carrito en el maximo posible en vez de no hacer nada:
        // es lo que la persona queria, hasta donde se puede.
        return existing
          ? prev.map((i) => (i.niceCode === item.niceCode ? { ...i, quantity: item.stock } : i))
          : [...prev, { ...item, quantity: item.stock }];
      }

      result = { ok: true, quantity: desired };
      return existing
        ? prev.map((i) => (i.niceCode === item.niceCode ? { ...i, quantity: desired, stock: item.stock } : i))
        : [...prev, { ...item, quantity }];
    });

    return result;
  }, []);

  const setQuantity = useCallback((niceCode: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.niceCode !== niceCode)
        : prev.map((i) =>
            i.niceCode === niceCode ? { ...i, quantity: Math.min(quantity, i.stock) } : i
          )
    );
  }, []);

  const remove = useCallback((niceCode: string) => {
    setItems((prev) => prev.filter((i) => i.niceCode !== niceCode));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subtotalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    return { items, count, subtotalCents, ready, add, setQuantity, remove, clear };
  }, [items, ready, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart necesita estar dentro de <CartProvider>.");
  return ctx;
}
