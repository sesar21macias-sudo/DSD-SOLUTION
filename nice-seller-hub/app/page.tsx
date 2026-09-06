import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { ArrowRight, MessageCircle, Package, Store } from "lucide-react";
import { getDb, schema } from "@/db";
import { outer } from "@/lib/sql-helpers";
import { Logo } from "@/components/Logo";
import { LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * La portada. No es la tienda de nadie: explica que es esto y lleva a las
 * tiendas que existen. Cuando haya cientos de distribuidoras esta lista se
 * convertira en un buscador, pero mostrarlas es lo correcto mientras sean pocas.
 */
async function getStores() {
  const db = await getDb();
  return db
    .select({
      slug: schema.sellers.slug,
      businessName: schema.sellers.businessName,
      city: schema.sellers.city,
      description: schema.sellers.description,
      profileImage: schema.sellers.profileImage,
      pieces: sql<number>`(
        select coalesce(sum(stock), 0) from seller_inventory
        where seller_id = ${outer("sellers", "id")} and is_visible = 1
      )`.as("pieces"),
    })
    .from(schema.sellers)
    .where(eq(schema.sellers.status, "active"))
    .orderBy(asc(schema.sellers.businessName))
    .limit(24);
}

export default async function HomePage() {
  const stores = await getStores();

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

      <section className="py-16 sm:py-24">
        <p className="animate-fade-up text-[12px] font-medium uppercase tracking-[0.2em] text-gold">
          Para distribuidoras NICE
        </p>
        <h1 className="animate-fade-up mt-5 max-w-2xl text-[38px] font-light leading-[1.08] sm:text-[56px]">
          Tu tienda NICE,
          <br />
          <span className="font-normal">pero digital.</span>
        </h1>
        <p className="animate-fade-up mt-6 max-w-lg text-[16px] leading-relaxed text-mute">
          Tus clientes ven exactamente lo que tienes disponible ahora mismo, arman su pedido y te
          llega completo a tu WhatsApp. Tú administras todo desde el teléfono.
        </p>

        <div className="animate-fade-up mt-10 flex flex-wrap gap-3">
          <LinkButton href="/register" size="lg">
            Crear mi tienda
            <ArrowRight size={17} strokeWidth={1.8} />
          </LinkButton>
          <LinkButton href="/login" size="lg" variant="secondary">
            Ya tengo cuenta
          </LinkButton>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
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
            icon: <Store size={19} strokeWidth={1.6} />,
            title: "Tu propio enlace",
            body: "Compártelo en tus redes. Cada distribuidora tiene su tienda aparte.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-line bg-surface p-6 shadow-card"
          >
            <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-gold-soft text-gold">
              {f.icon}
            </div>
            <p className="text-[15px] font-medium">{f.title}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{f.body}</p>
          </div>
        ))}
      </section>

      {stores.length > 0 && (
        <section className="mt-20">
          <h2 className="text-[17px] font-semibold">Tiendas activas</h2>
          <p className="mt-1 text-[13px] text-mute">
            Cada una muestra su propio inventario disponible.
          </p>

          <ul className="stagger mt-6 grid gap-3 sm:grid-cols-2">
            {stores.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/${s.slug}`}
                  className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <Avatar name={s.businessName} src={s.profileImage} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">{s.businessName}</p>
                    <p className="truncate text-[12px] text-mute">
                      {s.city ? `${s.city} · ` : ""}
                      {s.pieces} {s.pieces === 1 ? "pieza" : "piezas"} disponibles
                    </p>
                  </div>
                  <ArrowRight
                    size={16}
                    strokeWidth={1.8}
                    className="shrink-0 text-mute-soft transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ink"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-24 border-t border-line pt-8 text-[12px] text-mute">
        <Logo size="sm" className="text-mute" />
        <p className="mt-3 max-w-md leading-relaxed">
          NICE Seller Hub es una plataforma para distribuidoras independientes. Los productos y
          existencias los administra cada distribuidora.
        </p>
      </footer>
    </main>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full object-cover"
        loading="lazy"
      />
    );
  }
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold-soft text-[15px] font-medium text-gold">
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
