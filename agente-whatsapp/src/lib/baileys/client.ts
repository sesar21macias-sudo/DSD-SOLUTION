import path from "node:path";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import { setConnectionState, getConnectionState } from "../db";
import { handleIncomingMessages } from "./handler";

const logger = pino({ level: "silent" });
const authDir = path.resolve(process.cwd(), "auth");

let sock: WASocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let starting = false;

export function getSock(): WASocket | null {
  return sock;
}

function extractPhone(sockUserId: string | undefined): string | null {
  if (!sockUserId) return null;
  // formato tipico: "5491155...:12@s.whatsapp.net"
  const withoutSuffix = sockUserId.split("@")[0];
  return withoutSuffix.split(":")[0];
}

function scheduleReconnect(code: number | undefined) {
  if (reconnectTimer) return;
  const delay = code === 440 ? 15000 : 5000;
  console.log(`[bot] reconectando en ${delay}ms (code=${code ?? "desconocido"})`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (sock) {
      try {
        sock.end(undefined);
      } catch {
        // ignorar, el socket ya puede estar cerrado
      }
      sock = null;
    }
    void start();
  }, delay);
}

export async function start(): Promise<void> {
  if (starting) return;
  starting = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authDir);

    let version: [number, number, number] | undefined;
    try {
      const fetched = await fetchLatestBaileysVersion();
      version = fetched.version;
    } catch (err) {
      console.warn("[bot] No se pudo obtener la ultima version de Baileys:", err);
    }

    const current = getConnectionState();
    if (current.status === "disconnected") {
      setConnectionState({ status: "connecting" });
    }

    const newSock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });

    sock = newSock;

    newSock.ev.on("creds.update", saveCreds);

    newSock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("[bot] QR recibido, se muestra en el dashboard (localhost:3000)");
        qrcodeTerminal.generate(qr, { small: true });
        setConnectionState({ status: "qr", qr_string: qr, phone: null });
      }

      if (connection === "connecting") {
        const state = getConnectionState();
        if (state.status === "disconnected") {
          setConnectionState({ status: "connecting" });
        }
      }

      if (connection === "open") {
        const phone = extractPhone(newSock.user?.id);
        console.log(`[bot] conectado como ${phone}`);
        setConnectionState({ status: "connected", qr_string: null, phone });
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        console.log(`[bot] conexion cerrada, code=${statusCode}`);

        if (statusCode === DisconnectReason.loggedOut) {
          setConnectionState({ status: "disconnected", qr_string: null, phone: null });
          return;
        }

        // Cualquier otro codigo: no tocar el estado (puede seguir mostrando
        // 'connected' mientras reconecta transparentemente), solo reintentar.
        scheduleReconnect(statusCode);
      }
    });

    newSock.ev.on("messages.upsert", (payload) => {
      void handleIncomingMessages(newSock, payload);
    });
  } finally {
    starting = false;
  }
}

export async function shutdown(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try {
      await sock.logout();
    } catch {
      // puede fallar si ya no hay sesion activa, no es fatal
    }
    try {
      sock.end(undefined);
    } catch {
      // idem
    }
    sock = null;
  }
}
