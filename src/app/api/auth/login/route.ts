import { NextResponse } from "next/server";
import { setSession, verifyCredentials } from "@/lib/auth";
import { isSameOrigin } from "@/lib/validation";

const attempts = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const record = attempts.get(ip);
  if (record && record.resetAt > now && record.count >= 10) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email : "";
    const password = typeof body.password === "string" ? body.password : "";
    const valid = await verifyCredentials(email, password);
    if (!valid) {
      attempts.set(ip, { count: record && record.resetAt > now ? record.count + 1 : 1, resetAt: now + 15 * 60_000 });
      return NextResponse.json({ error: "E-mail ou senha incorretos." }, { status: 401 });
    }
    attempts.delete(ip);
    await setSession(email.trim().toLowerCase());
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Acesso administrativo não configurado no servidor." }, { status: 500 });
  }
}
