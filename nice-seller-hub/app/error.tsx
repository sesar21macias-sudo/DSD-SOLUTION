"use client";

import { useEffect } from "react";

/**
 * Nunca se le enseña el error tecnico a la persona: no le dice nada y puede
 * revelar como esta armado el sistema por dentro. El detalle va a la consola,
 * donde sirve.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[24px] font-light">Algo salió mal</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-mute">
        No pudimos cargar esta pantalla. Vuelve a intentarlo; si sigue igual, revisa tu conexión.
      </p>
      <button
        onClick={reset}
        className="mt-8 inline-flex h-11 items-center rounded-xl bg-ink px-5 text-[15px] font-medium text-white"
      >
        Reintentar
      </button>
    </main>
  );
}
