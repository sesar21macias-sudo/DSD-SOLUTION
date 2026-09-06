"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MapPin, MessageCircle, ShoppingBag } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { formatMoney } from "@/lib/format";
import { EmptyState, ErrorNote, Input, LinkButton, Textarea } from "@/components/ui";

/**
 * La ultima pantalla antes de WhatsApp.
 *
 * El nombre y el telefono son opcionales a proposito: obligar a registrarse
 * para mandar un pedido por WhatsApp es la forma mas rapida de perderlo. Si la
 * persona los escribe, la distribuidora ya tiene al cliente en su cartera; si
 * no, el pedido igual llega y ella lo pregunta en la conversacion.
 */
export function CheckoutView({
  slug,
  businessName,
  city,
  deliveryMethods,
  paymentMethods,
}: {
  slug: string;
  businessName: string;
  city: string | null;
  deliveryMethods: string | null;
  paymentMethods: string | null;
}) {
  const { items, count, subtotalCents, clear, ready } = useCart();
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ name: string; message: string }[]>([]);

  if (!ready) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <div className="skeleton h-40 rounded-2xl" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-5 py-8">
        <EmptyState
          icon={<ShoppingBag size={30} strokeWidth={1.3} />}
          title="No hay nada que confirmar"
          description="Tu pedido está vacío."
          action={
            <LinkButton href={`/${slug}`} variant="secondary">
              Ver las piezas
            </LinkButton>
          }
        />
      </main>
    );
  }

  async function send() {
    setError(null);
    setProblems([]);
    setSending(true);

    // La ventana se abre AHORA, dentro del gesto del dedo. Si se abriera
    // despues de que responda el servidor, Safari la bloquearia por ser una
    // ventana emergente sin interaccion.
    const popup = window.open("", "_blank");

    try {
      const res = await fetch(`/api/stores/${slug}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ niceCode: i.niceCode, quantity: i.quantity })),
          name: name.trim() || null,
          phone: phone.trim() || null,
          note: note.trim() || null,
        }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        orderNumber?: string;
        waUrl?: string;
        error?: string;
        problems?: { name: string; message: string }[];
      };

      if (!res.ok || !data.ok || !data.waUrl || !data.orderNumber) {
        popup?.close();
        setProblems(data.problems ?? []);
        setError(
          data.error ??
            (data.problems?.length
              ? "El inventario cambió. Revisa tu pedido antes de continuar."
              : "No pudimos generar tu pedido. Intenta otra vez.")
        );
        setSending(false);
        return;
      }

      if (popup) popup.location.href = data.waUrl;

      // El carrito se vacia solo despues de que el pedido quedo registrado.
      clear();
      router.push(`/${slug}/order/${data.orderNumber}`);
    } catch {
      popup?.close();
      setError("No pudimos conectar. Revisa tu señal e intenta otra vez.");
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="text-[26px] font-light">Tu pedido</h1>

      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {items.map((i) => (
          <li key={i.niceCode} className="flex items-baseline gap-3 px-4 py-3.5">
            <span className="w-7 shrink-0 text-[14px] font-medium tabular-nums text-mute">
              {i.quantity}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{i.name}</p>
              <p className="text-[11px] tabular-nums text-mute">NICE {i.niceCode}</p>
            </div>
            <span className="shrink-0 text-[14px] font-medium tabular-nums">
              {formatMoney(i.priceCents * i.quantity)}
            </span>
          </li>
        ))}

        <li className="flex items-baseline justify-between bg-canvas px-4 py-4">
          <span className="text-[15px] font-medium">
            Total
            <span className="ml-2 text-[12px] font-normal text-mute">
              {count} {count === 1 ? "pieza" : "piezas"}
            </span>
          </span>
          <span className="text-[20px] font-medium tabular-nums">
            {formatMoney(subtotalCents)}
            <span className="ml-1 text-[12px] font-normal text-mute">MXN</span>
          </span>
        </li>
      </ul>

      <section className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <p className="text-[12px] uppercase tracking-[0.14em] text-mute">Le compras a</p>
        <p className="mt-1.5 text-[16px] font-medium">{businessName}</p>
        {city && (
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-mute">
            <MapPin size={12} strokeWidth={1.8} />
            {city}
          </p>
        )}
        {deliveryMethods && (
          <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
            <span className="text-mute">Entrega: </span>
            {deliveryMethods}
          </p>
        )}
        {paymentMethods && (
          <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">
            <span className="text-mute">Pago: </span>
            {paymentMethods}
          </p>
        )}
      </section>

      <section className="mt-6 space-y-3">
        <p className="text-[13px] text-mute">
          Opcional: si dejas tus datos, {businessName.split(" ")[0]} ya sabe quién eres al recibir
          el pedido.
        </p>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tu nombre"
          autoComplete="name"
          maxLength={80}
        />
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Tu teléfono"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
        />
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="¿Algo que quieras aclarar? (opcional)"
          rows={2}
          maxLength={300}
        />
      </section>

      {error && (
        <div className="mt-5 space-y-2">
          <ErrorNote>{error}</ErrorNote>
          {problems.map((p) => (
            <ErrorNote key={p.name}>{p.message}</ErrorNote>
          ))}
          {problems.length > 0 && (
            <LinkButton href={`/${slug}/cart`} variant="secondary" size="sm">
              Revisar mi pedido
            </LinkButton>
          )}
        </div>
      )}

      <button
        onClick={send}
        disabled={sending}
        className="mt-6 flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] text-[16px] font-medium text-white shadow-lift transition-all duration-200 hover:bg-[#1eb457] active:scale-[0.99] disabled:opacity-60"
      >
        {sending ? (
          "Generando tu pedido…"
        ) : (
          <>
            <MessageCircle size={19} strokeWidth={2} />
            Enviar pedido por WhatsApp
          </>
        )}
      </button>

      <p className="mt-3 text-center text-[12px] leading-relaxed text-mute">
        Se abre WhatsApp con tu pedido ya escrito. Tú lo revisas y presionas enviar.
      </p>
    </main>
  );
}
