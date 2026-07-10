import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, "messages.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
  last_message_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_messages_conv
  ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS connection_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
    NOT NULL DEFAULT 'disconnected',
  qr_string TEXT,
  phone TEXT,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending
  ON outbox(sent, created_at);
`);

export type Mode = "AI" | "HUMAN";
export type Role = "user" | "assistant" | "human";
export type ConnectionStatus = "disconnected" | "qr" | "connecting" | "connected";

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: Mode;
  last_message_at: number | null;
  created_at: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: Role;
  content: string;
  created_at: number;
}

export interface ConnectionState {
  id: 1;
  status: ConnectionStatus;
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

// ── Conversations ──────────────────────────────────────────────

export function getOrCreateConversation(phone: string, name?: string | null): Conversation {
  const existing = db.prepare("SELECT * FROM conversations WHERE phone = ?").get(phone) as
    | Conversation
    | undefined;

  if (existing) {
    if (name && name !== existing.name) {
      db.prepare("UPDATE conversations SET name = ? WHERE id = ?").run(name, existing.id);
      existing.name = name;
    }
    return existing;
  }

  const info = db
    .prepare("INSERT INTO conversations (phone, name, mode) VALUES (?, ?, 'AI')")
    .run(phone, name ?? null);

  return db.prepare("SELECT * FROM conversations WHERE id = ?").get(info.lastInsertRowid) as Conversation;
}

export function getConversationById(id: number): Conversation | null {
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Conversation | undefined;
  return row ?? null;
}

export function setMode(conversationId: number, mode: Mode): void {
  db.prepare("UPDATE conversations SET mode = ? WHERE id = ?").run(mode, conversationId);
}

export interface ConversationListItem extends Conversation {
  last_message_preview: string | null;
}

export function listConversations(): ConversationListItem[] {
  return db
    .prepare(
      `SELECT c.*,
              (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_message_preview
       FROM conversations c
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
    )
    .all() as ConversationListItem[];
}

export function deleteConversation(id: number): void {
  const tx = db.transaction((conversationId: number) => {
    db.prepare("DELETE FROM outbox WHERE conversation_id = ? AND sent = 0").run(conversationId);
    db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(conversationId);
    db.prepare("DELETE FROM conversations WHERE id = ?").run(conversationId);
  });
  tx(id);
}

// ── Messages ────────────────────────────────────────────────────

export function insertMessage(conversationId: number, role: Role, content: string): Message {
  const tx = db.transaction((cId: number, r: Role, c: string) => {
    const info = db
      .prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)")
      .run(cId, r, c);
    db.prepare("UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?").run(cId);
    return info.lastInsertRowid;
  });

  const id = tx(conversationId, role, content);
  return db.prepare("SELECT * FROM messages WHERE id = ?").get(id) as Message;
}

export function getMessages(conversationId: number, limit = 50): Message[] {
  return db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id ASC LIMIT ?")
    .all(conversationId, limit) as Message[];
}

export function getRecentHistory(conversationId: number, limit = 20): Message[] {
  const rows = db
    .prepare("SELECT * FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?")
    .all(conversationId, limit) as Message[];
  return rows.reverse();
}

// ── Connection state ───────────────────────────────────────────

export function getConnectionState(): ConnectionState {
  return db.prepare("SELECT * FROM connection_state WHERE id = 1").get() as ConnectionState;
}

export function setConnectionState(
  partial: Partial<Pick<ConnectionState, "status" | "qr_string" | "phone">>
): void {
  const current = getConnectionState();
  const next = {
    status: partial.status ?? current.status,
    qr_string: "qr_string" in partial ? partial.qr_string : current.qr_string,
    phone: "phone" in partial ? partial.phone : current.phone,
  };
  db.prepare(
    "UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE id = 1"
  ).run(next.status, next.qr_string, next.phone);
}

// ── Outbox ──────────────────────────────────────────────────────

export interface OutboxItem {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

export function enqueueOutbox(conversationId: number, phone: string, content: string): void {
  db.prepare(
    "INSERT INTO outbox (conversation_id, phone, content, sent) VALUES (?, ?, ?, 0)"
  ).run(conversationId, phone, content);
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return db
    .prepare("SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC LIMIT ?")
    .all(limit) as OutboxItem[];
}

export function markOutboxSent(id: number): void {
  db.prepare("UPDATE outbox SET sent = 1 WHERE id = ?").run(id);
}
