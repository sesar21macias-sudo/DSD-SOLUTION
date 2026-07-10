"use client";

import { useEffect, useState } from "react";
import type { ConnectionStatus } from "@/lib/db";

interface Props {
  status: ConnectionStatus;
  qrPng: string | null;
}

export default function QRScreen({ status, qrPng }: Props) {
  const [disconnectedSince, setDisconnectedSince] = useState<number | null>(null);

  useEffect(() => {
    if (status === "disconnected" && !qrPng) {
      const start = Date.now();
      setDisconnectedSince(start);
    } else {
      setDisconnectedSince(null);
    }
  }, [status, qrPng]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const stuckTooLong =
    disconnectedSince !== null && now - disconnectedSince > 10000;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <h1 className="text-lg font-semibold text-neutral-100">Conectar numero de WhatsApp</h1>

      {status === "qr" && qrPng && (
        <>
          <div className="rounded-2xl border border-neutral-800 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrPng} alt="Codigo QR de WhatsApp" width={280} height={280} />
          </div>
          <p className="flex items-center gap-2 text-sm text-amber-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            Esperando escaneo... abre WhatsApp en tu telefono → Dispositivos vinculados
          </p>
        </>
      )}

      {status === "connecting" && !qrPng && (
        <p className="flex items-center gap-2 text-sm text-blue-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-400" />
          Conectando...
        </p>
      )}

      {status === "disconnected" && !qrPng && !stuckTooLong && (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-200" />
      )}

      {stuckTooLong && (
        <p className="max-w-sm text-sm text-red-400">
          Esto esta tardando mas de lo normal. Revisa que el proceso del bot
          (<code className="text-neutral-300">npm run start:bot</code>) siga corriendo, o reinicialo.
        </p>
      )}
    </div>
  );
}
