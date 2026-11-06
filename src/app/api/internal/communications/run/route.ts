import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchDueCommunications, scheduleBirthdayMessages } from "@/lib/communications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokensMatch(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.COMMUNICATIONS_CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || !supplied || !tokensMatch(secret, supplied)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const birthdaysScheduled = scheduleBirthdayMessages();
    const result = await dispatchDueCommunications(20);
    return NextResponse.json({ ok: true, birthdaysScheduled, result });
  } catch (error) {
    console.error("Communication dispatch failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha na rotina de mensagens." }, { status: 502 });
  }
}
