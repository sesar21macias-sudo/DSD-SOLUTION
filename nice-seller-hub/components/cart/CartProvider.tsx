"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
  /**
   * Las piezas que estaban libres para esta persona cuando la agregó — el
   * stock menos lo que otra tenía apartado. Solo sirve para avisar a tiempo;
   * la cuenta que manda la vuelve a hacer el servidor.
   */
  available: number;
}

/** Una pieza que no se pudo apartar completa. */
export interface HoldProblem {
  niceCode: string;
  name: string;
  available: number;
  message: string;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  subtotalCents: number;
  ready: boolean;
  /** Hasta cuándo están apartadas estas piezas, en ISO. Null = nada apartado. */
  holdExpiresAt: string | null;
  /** Lo que otra persona se llevó mientras esta lo pensaba. */
  holdProblems: HoldProblem[];
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => AddResult;
  setQuantity: (niceCode: string, quantity: number) => void;
  remove: (niceCode: string) => void;
  clear: () => void;
  /** Vuelve a apartar y renueva el reloj. La usa el aviso al vencerse. */
  renewHold: () => void;
}

export type AddResult = { ok: true; quantity: number } | { ok: false; message: string };

const CartContext = createContext<CartContextValue | null>(null);

// v2: la partida guarda `available` (lo libre para mí) en lugar de `stock`.
// Se sube la versión en vez de migrar: un carrito es una comodidad, no un
// registro, y leer uno viejo con la forma equivocada haría cuentas mal.
const VERSION = "v2";

/** Sin señales de vida por este rato, el apartado se deja vencer. */
const IDLE_LIMIT_MS = 10 * 60_000;
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
        typeof i.available === "number" &&
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

  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);
  const [holdProblems, setHoldProblems] = useState<HoldProblem[]>([]);
  const [holdTick, setHoldTick] = useState(0);

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

      if (item.available <= 0) {
        result = { ok: false, message: "Esta pieza no está disponible ahora." };
        return prev;
      }
      if (desired > item.available) {
        result = {
          ok: false,
          message:
            item.available === 1
              ? "Solo queda 1 pieza libre."
              : `Solo quedan ${item.available} piezas libres.`,
        };
        // Se deja el carrito en el maximo posible en vez de no hacer nada:
        // es lo que la persona queria, hasta donde se puede.
        return existing
          ? prev.map((i) =>
              i.niceCode === item.niceCode ? { ...i, quantity: item.available } : i
            )
          : [...prev, { ...item, quantity: item.available }];
      }

      result = { ok: true, quantity: desired };
      return existing
        ? prev.map((i) =>
            i.niceCode === item.niceCode
              ? { ...i, quantity: desired, available: item.available }
              : i
          )
        : [...prev, { ...item, quantity }];
    });

    return result;
  }, []);

  const setQuantity = useCallback((niceCode: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.niceCode !== niceCode)
        : prev.map((i) =>
            i.niceCode === niceCode ? { ...i, quantity: Math.min(quantity, i.available) } : i
          )
    );
  }, []);

  const remove = useCallback((niceCode: string) => {
    setItems((prev) => prev.filter((i) => i.niceCode !== niceCode));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const renewHold = useCallback(() => setHoldTick((t) => t + 1), []);

  /**
   * Apartar las piezas mientras esta persona decide.
   *
   * Corre al cambiar el carrito —con un respiro de 900 ms, para no mandar una
   * petición por cada toque en el botón de "+"— y cada minuto mientras la
   * pestaña siga abierta, que es lo que renueva el vencimiento.
   *
   * Si algo ya no alcanza, el carrito se ajusta a lo que sí se pudo apartar en
   * vez de quedarse prometiendo una pieza que ya es de alguien más. La pantalla
   * lo dice con nombre y apellido; ajustarlo en silencio sería peor.
   */
  const inFlight = useRef<AbortController | null>(null);

  /**
   * Cuándo fue la última vez que hubo alguien de verdad del otro lado.
   *
   * Renovar el apartado solo porque una pestaña sigue abierta sería lo peor de
   * los dos mundos: la pieza queda retenida para siempre por alguien que se fue
   * a dormir, y la clienta que sí la quiere nunca la ve. El apartado se sostiene
   * con presencia, no con una pestaña.
   */
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events = ["pointerdown", "keydown", "scroll", "focus"] as const;
    for (const e of events) window.addEventListener(e, touch, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, touch);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;

    const send = async () => {
      inFlight.current?.abort();
      const ctrl = new AbortController();
      inFlight.current = ctrl;

      try {
        const res = await fetch(`/api/stores/${slug}/hold`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            release: items.length === 0,
            items: items.map((i) => ({ niceCode: i.niceCode, quantity: i.quantity })),
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          expiresAt?: string | null;
          items?: { niceCode: string; held: number }[];
          problems?: HoldProblem[];
        };
        if (!res.ok || !data.ok) return;

        setHoldExpiresAt(data.expiresAt ?? null);
        setHoldProblems(data.problems ?? []);

        // Ajustar el carrito a lo que de verdad se apartó.
        const held = new Map((data.items ?? []).map((i) => [i.niceCode, i.held]));
        setItems((prev) => {
          let changed = false;
          const next = prev
            .map((item) => {
              const max = held.get(item.niceCode);
              if (max === undefined || max === item.quantity) return item;
              changed = true;
              return { ...item, quantity: max };
            })
            .filter((item) => item.quantity > 0);
          return changed ? next : prev;
        });
      } catch {
        // Sin señal el apartado no se renueva y termina venciendo solo, que es
        // lo correcto: nadie debe retener una pieza sin estar presente.
      }
    };

    const debounce = setTimeout(send, 900);

    // La renovación automática solo corre mientras haya alguien. Pasados diez
    // minutos sin un toque, una tecla o un scroll, se deja de renovar: el
    // apartado vence solo y la pieza vuelve a la tienda. Quien regrese verá el
    // aviso de que se acabó su tiempo y podrá volver a apartarla de un toque.
    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) return;
      send();
    }, 60_000);

    // Una pestaña en segundo plano puede tener el temporizador frenado por el
    // navegador; al volver a ella hay que renovar de inmediato.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      // Volver a la pestaña es actividad: la persona está aquí otra vez.
      lastActivity.current = Date.now();
      send();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(debounce);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      inFlight.current?.abort();
    };
  }, [items, slug, ready, holdTick]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((s, i) => s + i.quantity, 0);
    const subtotalCents = items.reduce((s, i) => s + i.priceCents * i.quantity, 0);
    return {
      items,
      count,
      subtotalCents,
      ready,
      holdExpiresAt: items.length > 0 ? holdExpiresAt : null,
      holdProblems,
      add,
      setQuantity,
      remove,
      clear,
      renewHold,
    };
  }, [items, ready, holdExpiresAt, holdProblems, add, setQuantity, remove, clear, renewHold]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart necesita estar dentro de <CartProvider>.");
  return ctx;
}
