import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handleEvolutionWebhook } from "@/lib/communications";

export const runtime = "nodejs";

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  const supplied = new URL(request.url).searchParams.get("secret") || "";
  if (!expected || !supplied || !safeEqual(expected, supplied)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const result = handleEvolutionWebhook(await request.json());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Evolution webhook failed", error);
    return NextResponse.json({ error: "Webhook inválido." }, { status: 400 });
  }
}
