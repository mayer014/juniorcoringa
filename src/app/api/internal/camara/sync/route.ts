import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { syncCamaraData } from "@/lib/camara-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokensMatch(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function POST(request: Request) {
  const secret = process.env.CAMARA_SYNC_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!secret || !supplied || !tokensMatch(supplied, secret)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  try {
    const result = await syncCamaraData();
    revalidatePath("/");
    revalidatePath("/noticias");
    revalidatePath("/atuacao-legislativa");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Sincronização agendada da Câmara falhou:", error);
    const message = error instanceof Error ? error.message : "Falha na sincronização.";
    return NextResponse.json({ error: message }, { status: /andamento/i.test(message) ? 409 : 502 });
  }
}
