import { NextRequest, NextResponse } from "next/server";
import { getConversationById, getMessages, insertMessage, enqueueOutbox } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);

  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }

  const messages = getMessages(id, 200);
  return NextResponse.json({ conversation, messages });
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);

  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "content es requerido" }, { status: 400 });
  }

  const message = insertMessage(id, "human", content);
  enqueueOutbox(id, conversation.phone, content);

  return NextResponse.json({ ok: true, messageId: message.id });
}
