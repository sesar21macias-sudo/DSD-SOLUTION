import { NextRequest, NextResponse } from "next/server";
import { deleteConversation, getConversationById } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);

  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }

  deleteConversation(id);
  return NextResponse.json({ ok: true });
}
