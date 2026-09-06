import Link from "next/link";
import { Logo } from "@/components/Logo";

/**
 * Cubre dos casos con el mismo mensaje: la tienda no existe, o la pieza no
 * esta en esa tienda. Distinguirlos no le sirve a nadie y revelaria que una
 * tienda existe pero esta suspendida.
 */
export default function StoreNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-[24px] font-light">Esto ya no está disponible</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-mute">
        La tienda o la pieza que buscas no existe. Si te la compartieron por WhatsApp, pídele el
        enlace otra vez a tu distribuidora.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-xl bg-ink px-5 text-[15px] font-medium text-white"
      >
        Ver otras tiendas
      </Link>
    </main>
  );
}
