"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Instagram, MapPin, MessageCircle, Share2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ShareSheet } from "./ShareSheet";
import { CartIcon } from "./CartIcon";

/**
 * La cabecera de la tienda. En la portada se despliega completa —foto, ciudad,
 * descripcion, contacto— porque es la carta de presentacion de la
 * distribuidora. En las paginas internas se encoge a una barra con flecha de
 * regreso: ahi el protagonista es la pieza, no ella.
 */
export function StoreHeader(props: {
  slug: string;
  businessName: string;
  city: string | null;
  state: string | null;
  description: string | null;
  profileImage: string | null;
  whatsapp: string;
  instagram: string | null;
  facebook: string | null;
}) {
  const pathname = usePathname();
  const [shareOpen, setShareOpen] = useState(false);
  const isHome = pathname === `/${props.slug}`;

  const location = [props.city, props.state].filter(Boolean).join(", ");

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur-xl ${
          isHome ? "" : "shadow-[0_1px_0_rgb(0_0_0/0.02)]"
        }`}
      >
        <div className="safe-top mx-auto flex h-14 max-w-3xl items-center gap-3 px-5">
          {isHome ? (
            <Link href="/" aria-label="NICE Seller Hub">
              <Logo size="sm" />
            </Link>
          ) : (
            <Link
              href={`/${props.slug}`}
              className="-ml-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[14px] text-ink-soft transition-colors hover:bg-line/60"
            >
              <ChevronLeft size={17} strokeWidth={1.8} />
              <span className="max-w-[10rem] truncate">{props.businessName}</span>
            </Link>
          )}

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setShareOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-full text-ink-soft transition-colors hover:bg-line/60"
              aria-label="Compartir tienda"
            >
              <Share2 size={17} strokeWidth={1.7} />
            </button>
            <CartIcon slug={props.slug} />
          </div>
        </div>
      </header>

      {isHome && (
        <section className="mx-auto max-w-3xl px-5 pb-8 pt-8">
          <div className="animate-fade-up flex items-start gap-4">
            {props.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={props.profileImage}
                alt=""
                className="h-[72px] w-[72px] shrink-0 rounded-full object-cover ring-1 ring-line"
              />
            ) : (
              <span className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-gold-soft text-[26px] font-light text-gold">
                {props.businessName.trim().charAt(0).toUpperCase()}
              </span>
            )}

            <div className="min-w-0 flex-1 pt-1">
              <h1 className="text-[26px] font-medium leading-tight">{props.businessName}</h1>
              <p className="mt-0.5 text-[13px] text-mute">Distribuidora NICE</p>
              {location && (
                <p className="mt-1.5 flex items-center gap-1 text-[13px] text-mute">
                  <MapPin size={13} strokeWidth={1.7} />
                  {location}
                </p>
              )}
            </div>
          </div>

          {props.description && (
            <p className="animate-fade-up mt-5 max-w-xl text-[15px] leading-relaxed text-ink-soft">
              {props.description}
            </p>
          )}

          <div className="animate-fade-up mt-6 flex flex-wrap gap-2">
            <a
              href={`https://wa.me/${props.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[14px] font-medium text-white transition-all duration-200 hover:bg-ink-soft active:scale-[0.98]"
            >
              <MessageCircle size={15} strokeWidth={1.9} />
              WhatsApp
            </a>
            <button
              onClick={() => setShareOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-[14px] font-medium transition-all duration-200 hover:border-ink/25 active:scale-[0.98]"
            >
              <Share2 size={15} strokeWidth={1.9} />
              Compartir tienda
            </button>
            {props.instagram && (
              <a
                href={`https://instagram.com/${props.instagram.replace(/^@/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-10 w-10 place-items-center rounded-full border border-line-strong bg-surface text-ink-soft transition-colors hover:border-ink/25 hover:text-ink"
                aria-label="Instagram"
              >
                <Instagram size={16} strokeWidth={1.8} />
              </a>
            )}
          </div>
        </section>
      )}

      {shareOpen && (
        <ShareSheet
          slug={props.slug}
          businessName={props.businessName}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
