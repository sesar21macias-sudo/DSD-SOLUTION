import Link from "next/link";
import { ChevronLeft, TriangleAlert } from "lucide-react";
import { LEGAL, legalIsComplete } from "@/lib/legal";
import { Logo } from "@/components/Logo";

/**
 * El marco de las páginas legales.
 *
 * Texto y nada más: sin animaciones, sin tarjetas, con medida de lectura corta.
 * Un documento que alguien puede necesitar leer con calma —o enseñárselo a un
 * abogado— no debe pelearse con el diseño del resto del sitio.
 */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-2xl px-5 pb-24">
      <header className="flex items-center justify-between py-6">
        <Link href="/" aria-label={LEGAL.platform}>
          <Logo />
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1 text-[13px] text-mute transition-colors hover:text-ink"
        >
          <ChevronLeft size={15} strokeWidth={1.8} />
          Volver
        </Link>
      </header>

      <h1 className="mt-6 font-display text-[32px] font-normal leading-tight sm:text-[40px]">
        {title}
      </h1>
      <p className="mt-2 text-[13px] text-mute">Última actualización: {LEGAL.updatedAt}</p>

      {/* Mientras falten los datos del responsable, el documento no cumple: se
          dice en la propia página en vez de publicarlo como si estuviera listo. */}
      {!legalIsComplete() && (
        <p className="mt-6 flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3.5 text-[13px] leading-relaxed text-amber-900">
          <TriangleAlert size={16} strokeWidth={1.9} className="mt-0.5 shrink-0" />
          <span>
            Este documento todavía está incompleto: falta el correo de contacto del responsable.
            Se completa en <code className="text-[12px]">lib/legal.ts</code>.
          </span>
        </p>
      )}

      <div className="legal mt-8">{children}</div>

      <footer className="mt-16 flex gap-5 border-t border-line pt-6 text-[13px] text-mute">
        <Link href="/privacidad" className="transition-colors hover:text-ink">
          Aviso de privacidad
        </Link>
        <Link href="/terminos" className="transition-colors hover:text-ink">
          Términos
        </Link>
      </footer>
    </main>
  );
}

/** Cómo contactar al responsable, escrito igual en los dos documentos. */
export function ContactBlock() {
  return (
    <p>
      {LEGAL.responsible}
      {LEGAL.address ? `, ${LEGAL.address}` : ""}.
      {LEGAL.contactEmail ? (
        <>
          {" "}
          Correo de contacto:{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="underline underline-offset-2">
            {LEGAL.contactEmail}
          </a>
          .
        </>
      ) : (
        <> Correo de contacto: pendiente de publicar.</>
      )}
      {LEGAL.contactWhatsapp ? (
        <>
          {" "}
          WhatsApp:{" "}
          <a
            href={`https://wa.me/${LEGAL.contactWhatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            escríbenos
          </a>
          .
        </>
      ) : null}
    </p>
  );
}
