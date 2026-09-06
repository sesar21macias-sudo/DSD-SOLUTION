import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <Logo />
      <h1 className="mt-8 text-[24px] font-light">No encontramos esta página</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-mute">
        Puede que el enlace haya cambiado o que la tienda ya no esté disponible.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex h-11 items-center rounded-xl bg-ink px-5 text-[15px] font-medium text-white"
      >
        Ir al inicio
      </Link>
    </main>
  );
}
