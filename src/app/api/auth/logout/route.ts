import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { isSameOrigin } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  await clearSession();
  return NextResponse.json({ ok: true });
}
