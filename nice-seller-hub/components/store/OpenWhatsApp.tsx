"use client";

import { MessageCircle } from "lucide-react";

/**
 * El boton que abre WhatsApp con el pedido escrito.
 *
 * Al tocarlo se avisa al servidor —con `sendBeacon`, que no bloquea la
 * navegacion— de que el pedido si salio, para que en el panel de la
 * distribuidora aparezca como "Enviado por WhatsApp" y no como pendiente.
 * Si el aviso se pierde, el pedido sigue existiendo: es informacion de estado,
 * no parte del pedido.
 */
export function OpenWhatsApp({
  href,
  orderNumber,
  slug,
}: {
  href: string;
  orderNumber: string;
  slug: string;
}) {
  function markSent() {
    try {
      navigator.sendBeacon(
        `/api/stores/${slug}/orders/${encodeURIComponent(orderNumber)}/sent`,
        new Blob([], { type: "text/plain" })
      );
    } catch {
      // Sin beacon disponible no pasa nada: la distribuidora igual ve el pedido.
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={markSent}
      className="mt-6 flex h-16 w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] text-[16px] font-medium text-white shadow-lift transition-all duration-200 hover:bg-[#1eb457] active:scale-[0.99]"
    >
      <MessageCircle size={19} strokeWidth={2} />
      Enviar por WhatsApp
    </a>
  );
}
