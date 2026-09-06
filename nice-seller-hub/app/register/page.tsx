import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Crear mi tienda" };

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 py-12">
      <Link href="/" className="mb-10 self-start">
        <Logo />
      </Link>

      <h1 className="text-[28px] font-light leading-tight">
        Crea tu
        <br />
        <span className="font-normal">tienda NICE.</span>
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-mute">
        En un minuto tienes tu enlace listo para compartir.
      </p>

      <div className="mt-8">
        <Suspense fallback={null}>
          <AuthForm mode="register" />
        </Suspense>
      </div>

      <p className="mt-8 text-center text-[13px] text-mute">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Entrar
        </Link>
      </p>
    </main>
  );
}
