import type { WASocket, WAMessage, BaileysEventMap } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
  getPendingOutbox,
  markOutboxSent,
} from "../db";
import { generateReply } from "../openrouter";

function extractText(msg: WAMessage): string | null {
  const m = msg.message;
  if (!m) return null;
  return m.conversation ?? m.extendedTextMessage?.text ?? null;
}

function extractPhone(remoteJid: string): string {
  return remoteJid.split("@")[0];
}

export async function handleIncomingMessages(
  sock: WASocket,
  payload: BaileysEventMap["messages.upsert"]
): Promise<void> {
  console.log(`[bot][debug] messages.upsert type=${payload.type} count=${payload.messages.length}`);
  if (payload.type !== "notify") return;

  for (const msg of payload.messages) {
    const remoteJid = msg.key.remoteJid;
    console.log(
      `[bot][debug] msg remoteJid=${remoteJid} fromMe=${msg.key.fromMe} keys=${Object.keys(msg.message ?? {}).join(",")}`
    );
    if (!remoteJid) continue;
    if (msg.key.fromMe) continue;
    if (remoteJid.endsWith("@g.us")) continue;
    if (!remoteJid.endsWith("@s.whatsapp.net") && !remoteJid.endsWith("@lid")) continue;

    const text = extractText(msg);
    if (!text) continue;

    const phone = extractPhone(remoteJid);
    console.log(`[bot] <- Mensaje de ${phone}: "${text}"`);

    const conversation = getOrCreateConversation(phone, msg.pushName ?? undefined);
    insertMessage(conversation.id, "user", text);

    // Re-leer: el modo pudo cambiar entre la creacion de la conversacion y este punto
    const fresh = getConversationById(conversation.id);
    if (!fresh || fresh.mode !== "AI") continue;

    try {
      const history = getRecentHistory(conversation.id, 20);
      console.log(`[bot] llamando LLM con ${history.length} mensajes...`);
      const startedAt = Date.now();
      const reply = await generateReply(history);
      console.log(`[bot] LLM respondio en ${Date.now() - startedAt}ms`);

      insertMessage(conversation.id, "assistant", reply);
      await sock.sendMessage(remoteJid, { text: reply });
      console.log(`[bot] -> Enviado a ${phone}`);
    } catch (err) {
      console.error(`[bot] error generando/enviando respuesta a ${phone}:`, err);
    }
  }
}

let outboxTimer: NodeJS.Timeout | null = null;

export function startOutboxLoop(getSock: () => WASocket | null): void {
  if (outboxTimer) return;

  outboxTimer = setInterval(async () => {
    const sock = getSock();
    if (!sock) return;

    const pending = getPendingOutbox(20);
    for (const item of pending) {
      try {
        await sock.sendMessage(`${item.phone}@s.whatsapp.net`, { text: item.content });
        markOutboxSent(item.id);
        console.log(`[bot] -> (humano) enviado a ${item.phone}`);
      } catch (err) {
        console.error(`[bot] fallo enviando mensaje humano a ${item.phone}, reintenta:`, err);
        // se deja sent=0, se reintenta en el siguiente tick
      }
    }
  }, 2000);
}

export function stopOutboxLoop(): void {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }
}
