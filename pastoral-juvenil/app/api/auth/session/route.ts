import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ admin: await isAdminSession() });
}
