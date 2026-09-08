import Link from "next/link";
import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { findResetTarget } from "@/lib/password-reset";
import { Logo } from "@/components/Logo";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Poner una contraseña nueva con el enlace que le mandaron.
 *
 * La pagina no dice de quien es la cuenta mas alla del nombre: quien tiene el
 * enlace ya puede entrar, pero un enlace vencido que alguien reenvio por error
 * no tiene por que revelar el correo de nadie.
 */
export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = await findResetTarget(token);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5 py-10">
      <Link href="/" className="mb-8 self-start" aria-label="Inicio">
        <Logo />
      </Link>

      {!target ? (
        <>
          <div className="mb-5 grid h-11 w-11 place-items-center rounded-2xl bg-canvas text-mute">
            <KeyRound size={20} strokeWidth={1.7} />
          </div>
          <h1 className="font-display text-[30px] font-normal leading-tight">
            Este enlace ya no sirve
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-mute">
            Los enlaces para cambiar contraseña duran 12 horas y se pueden usar una sola vez. Pide
            uno nuevo a quien administra la plataforma.
          </p>
          <Link
            href="/login"
            className="mt-7 text-[14px] font-medium underline underline-offset-4"
          >
            Ir a iniciar sesión
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-[30px] font-normal leading-tight">
            Hola, {target.name.split(" ")[0]}
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-mute">
            Escribe tu contraseña nueva. Con ella entras de inmediato.
          </p>
          <ResetPasswordForm token={token} />
        </>
      )}
    </main>
  );
}
