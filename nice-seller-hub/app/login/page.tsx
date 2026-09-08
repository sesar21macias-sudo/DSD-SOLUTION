import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Entrar" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-10 self-start">
        <Logo />
      </Link>

      <h1 className="text-[28px] font-light leading-tight">
        Entra a tu
        <br />
        <span className="font-normal">tienda digital.</span>
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-mute">
        Administra tu inventario, tus pedidos y tus clientes.
      </p>

      <div className="mt-8">
        <Suspense fallback={null}>
          <AuthForm mode="login" />
        </Suspense>
      </div>

      <p className="mt-8 text-center text-[13px] text-mute">
        ¿Todavía no tienes tienda?{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4">
          Contáctanos
        </Link>
      </p>
    </main>
  );
}
