import Link from "next/link";
import { desc, isNotNull } from "drizzle-orm";
import {
  ArrowRight,
  Clock,
  FileSpreadsheet,
  MessageCircle,
  Package,
  ScanLine,
  Sparkles,
  Wallet,
} from "lucide-react";
import { getDb, schema } from "@/db";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";
import { LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * La portada.
 *
 * Habla con una sola persona: una distribuidora NICE que todavia no tiene su
 * tienda. No es un directorio y **no lista las tiendas que existen**.
 *
 * Esa lista existio y estaba mal. Ponerlas todas juntas convertia la plataforma
 * en un aparador donde las distribuidoras compiten entre ellas por la misma
 * clienta, que es exactamente lo contrario de la premisa: cada una tiene su
 * tienda, con su inventario y sus clientas. Ademas dejaba a la vista de
 * cualquiera —incluida la de enfrente— quien vende, en que ciudad y cuantas
 * piezas tiene.
 *
 * Una clienta no llega aqui: llega por el enlace que su distribuidora le
 * compartio o por su codigo QR. Quien necesita ver todas las tiendas es el
 * administrador, y para eso esta /admin.
 */

/**
 * Piezas reales del catalogo NICE para la portada.
 *
 * Son del catalogo global, que es comun a todas: no dicen de quien son ni
 * cuantas hay. Enseñan de que se trata esto sin exponer el negocio de nadie.
 */
async function getShowcase() {
  const db = await getDb();
  return db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      imageUrl: schema.products.imageUrl,
    })
    .from(schema.products)
    .where(isNotNull(schema.products.imageUrl))
    .orderBy(desc(schema.products.id))
    .limit(3);
}

const FEATURES = [
  {
    icon: <Package size={19} strokeWidth={1.6} />,
    title: "Tu inventario real",
    body: "Solo aparece lo que tienes físicamente. Nada de vender lo que ya no está.",
  },
  {
    icon: <MessageCircle size={19} strokeWidth={1.6} />,
    title: "Pedidos por WhatsApp",
    body: "El pedido llega escrito, con folio, piezas y total. Tú solo confirmas.",
  },
  {
    icon: <ScanLine size={19} strokeWidth={1.6} />,
    title: "Carga con una foto",
    body: "Fotografía el ticket de tu mercancía y damos de alta las piezas con su foto y su precio.",
  },
  {
    icon: <Wallet size={19} strokeWidth={1.6} />,
    title: "Sabes cuánto ganas",
    body: "Con tu descuento de distribuidora calculamos tu costo, tu margen y tu ganancia real.",
  },
  {
    icon: <Clock size={19} strokeWidth={1.6} />,
    title: "Ventas a abonos",
    body: "Registra apartados, cobra abonos y ten a la mano lo que te deben.",
  },
  {
    icon: <FileSpreadsheet size={19} strokeWidth={1.6} />,
    title: "Todo en Excel",
    body: "Descarga tus ventas, tu inventario y tus clientes cuando quieras.",
  },
];

export default async function HomePage() {
  const showcase = await getShowcase();

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24">
      <header className="flex items-center justify-between py-6">
        <Logo />
        <Link
          href="/login"
          className="text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
        >
          Entrar
        </Link>
      </header>

      {/* Portada ------------------------------------------------------------ */}
      <section className="grid items-center gap-10 py-14 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
        <div>
          <p className="animate-fade-up flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-gold">
            <Sparkles size={12} strokeWidth={2} />
            Para distribuidoras independientes
          </p>

          <h1 className="animate-fade-up mt-6 font-display text-[42px] font-normal leading-[1.04] tracking-[-0.01em] sm:text-[58px]">
            Tu joyería,
            <br />
            <span className="text-foil">en su propia vitrina.</span>
          </h1>

          <div className="gold-rule mt-7 w-28" style={{ animationDelay: "0.3s" }} />

          <p className="animate-fade-up mt-7 max-w-md text-[16px] leading-relaxed text-mute">
            Tus clientas ven exactamente las piezas que tienes ahora mismo, arman su pedido y te
            llega completo a tu WhatsApp. Tú administras todo desde el teléfono.
          </p>

          <div className="animate-fade-up mt-9 flex flex-wrap gap-3">
            <LinkButton href="/register" size="lg">
              Quiero mi tienda
              <ArrowRight size={17} strokeWidth={1.8} />
            </LinkButton>
            <LinkButton href="/login" size="lg" variant="secondary">
              Ya tengo cuenta
            </LinkButton>
          </div>
        </div>

        {showcase.length > 0 && (
          <div className="animate-fade order-first grid grid-cols-3 gap-3 lg:order-none lg:gap-4">
            {showcase.map((p, i) => (
              <div
                key={p.id}
                className={`animate-float overflow-hidden rounded-2xl bg-surface shadow-card ${
                  i === 1 ? "lg:mt-10" : i === 2 ? "lg:mt-4" : ""
                }`}
                style={{ animationDelay: `${i * 1.1}s` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl ?? ""}
                  alt={p.name}
                  loading="eager"
                  decoding="async"
                  className="aspect-[3/4] w-full object-cover"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Lo que hace ------------------------------------------------------- */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f, i) => (
          <Reveal key={f.title} delay={(i % 3) * 90}>
            <div className="h-full rounded-2xl border border-line bg-surface p-6 shadow-card transition-shadow duration-300 hover:shadow-lift">
              <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-gold-soft text-gold">
                {f.icon}
              </div>
              <p className="text-[15px] font-medium">{f.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{f.body}</p>
            </div>
          </Reveal>
        ))}
      </section>

      {/* El club ----------------------------------------------------------- */}
      <Reveal>
        <section className="card-foil mt-6 overflow-hidden rounded-[26px] p-8 text-white shadow-lift sm:p-12">
          <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
            <Sparkles size={12} strokeWidth={2} />
            Club de puntos
          </p>
          <h2 className="mt-5 max-w-lg font-display text-[30px] font-normal leading-[1.15] sm:text-[38px]">
            Tus clientas vuelven porque están juntando algo.
          </h2>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-white/65">
            Tú activas tu propio club: pones la tasa de puntos, tus recompensas y tus condiciones.
            Tus clientas se registran con su nombre y su teléfono —nada más— y ven sus puntos desde
            el celular.
          </p>
          <p className="mt-6 text-[13px] text-white/45">
            Los puntos son tuyos y de tus clientas. Ninguna otra distribuidora los ve.
          </p>
        </section>
      </Reveal>

      {/* Tu tienda es tuya -------------------------------------------------- */}
      <Reveal>
        <section className="mt-6 rounded-[26px] border border-line bg-surface p-8 shadow-card sm:p-12">
          <h2 className="max-w-lg font-display text-[26px] font-normal leading-[1.2] sm:text-[32px]">
            Tu tienda es tuya, y solo tuya.
          </h2>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-mute">
            Aquí no hay un directorio donde tus clientas puedan irse con otra distribuidora. Tu
            enlace lo compartes tú, con quien tú quieras. Tu inventario, tus precios, tus clientas y
            tus ventas no los ve ninguna otra persona que use la plataforma.
          </p>
        </section>
      </Reveal>

      <footer className="mt-24 border-t border-line pt-8 text-[12px] text-mute">
        <Logo size="sm" className="text-mute" />
        <p className="mt-3 max-w-md leading-relaxed">
          DSD Seller Hub es una plataforma para distribuidoras independientes. Los productos y
          existencias los administra cada distribuidora.
        </p>
        <p className="mt-4 max-w-md leading-relaxed">
          ¿Buscabas la tienda de tu distribuidora? Pídele su enlace o escanea su código QR: cada
          tienda tiene su propia dirección.
        </p>

        <div className="mt-6 flex gap-5">
          <Link href="/privacidad" className="transition-colors hover:text-ink">
            Aviso de privacidad
          </Link>
          <Link href="/terminos" className="transition-colors hover:text-ink">
            Términos
          </Link>
        </div>
      </footer>
    </main>
  );
}
