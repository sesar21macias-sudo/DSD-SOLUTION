// env-loader DEBE ser el primer import: los imports de ES modules se
// hoistean al top, y openrouter.ts (importado transitivamente via client.ts)
// lee OPENROUTER_API_KEY en su top-level. Si el loader no corre primero,
// esas variables quedan undefined.
import "./env-loader";

import path from "node:path";
import fs from "node:fs";
import { start, shutdown } from "../src/lib/baileys/client";
import { startOutboxLoop, stopOutboxLoop } from "../src/lib/baileys/handler";
import { getSock } from "../src/lib/baileys/client";

const authDir = path.resolve(process.cwd(), "auth");
const restartFlag = path.resolve(process.cwd(), "data", ".restart");

async function main() {
  console.log("[bot] iniciando...");
  await start();
  startOutboxLoop(getSock);
  console.log("[bot] listo. El QR (si hace falta) aparece en localhost:3000 y tambien impreso arriba en ASCII.");

  setInterval(() => {
    if (fs.existsSync(restartFlag)) {
      void handleManualDisconnect();
    }
  }, 1000);
}

async function handleManualDisconnect() {
  console.log("[bot] desconexion manual solicitada desde el dashboard...");
  try {
    fs.unlinkSync(restartFlag);
  } catch {
    // pudo haberse borrado ya
  }

  stopOutboxLoop();
  await shutdown();

  // Defensa extra: aunque shutdown() ya hizo logout, nos aseguramos de que
  // no quede sesion residual en disco antes de volver a arrancar.
  fs.rmSync(authDir, { recursive: true, force: true });

  console.log("[bot] sesion borrada, reiniciando para generar un QR nuevo...");
  await start();
  startOutboxLoop(getSock);
}

main().catch((err) => {
  console.error("[bot] error fatal:", err);
  process.exit(1);
});
