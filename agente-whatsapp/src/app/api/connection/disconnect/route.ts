import path from "node:path";
import fs from "node:fs";
import { NextResponse } from "next/server";
import { setConnectionState } from "@/lib/db";

export async function POST() {
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  const authDir = path.resolve(process.cwd(), "auth");
  fs.rmSync(authDir, { recursive: true, force: true });

  const dataDir = path.resolve(process.cwd(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, ".restart"), "");

  return NextResponse.json({ ok: true });
}
