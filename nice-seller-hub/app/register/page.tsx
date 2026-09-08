import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { Logo } from "@/components/Logo";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Crear mi tienda" };

/**
 * El alta ya no es de quien llega: es de quien ya pagó.
 *
 * Antes esta pantalla tenía el formulario. Ahora solo explica a dónde
 * escribir — la cuenta la crea el administrador desde /admin/sellers/new y
 * manda las credenciales por WhatsApp una vez que hay pago.
 */
export default function RegisterPage() {
  const contactHref = LEGAL.contactWhatsapp
    ? `https://wa.me/${LEGAL.contactWhatsapp}`
    : `mailto:${LEGAL.contactEmail}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-10 self-start">
        <Logo />
      </Link>

      <h1 className="text-[28px] font-light leading-tight">
        Quiero mi
        <br />
        <span className="font-normal">tienda digital.</span>
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-mute">
        Las cuentas nuevas se dan de alta directamente contigo. Escríbenos y te ayudamos con el
        alta y el pago.
      </p>

      <a
        href={contactHref}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-[15px] font-medium text-white transition-all hover:bg-ink-soft active:scale-[0.99]"
      >
        <MessageCircle size={17} strokeWidth={1.9} />
        Contactar
      </a>

      <p className="mt-8 text-center text-[13px] text-mute">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </main>
  );
}
