import { NextRequest, NextResponse } from "next/server";
import { getConversationById, setMode } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = Number(conversationId);

  const conversation = getConversationById(id);
  if (!conversation) {
    return NextResponse.json({ error: "Conversacion no encontrada" }, { status: 404 });
  }

  const body = await req.json();
  const mode = body?.mode;
  if (mode !== "AI" && mode !== "HUMAN") {
    return NextResponse.json({ error: "mode debe ser 'AI' o 'HUMAN'" }, { status: 400 });
  }

  setMode(id, mode);
  return NextResponse.json({ ok: true });
}
