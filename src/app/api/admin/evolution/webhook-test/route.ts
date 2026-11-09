import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { decryptCitizenValue } from "@/lib/citizen-privacy";
import { db } from "@/lib/db";
import { isSameOrigin } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  const secret = process.env.EVOLUTION_WEBHOOK_SECRET?.trim();
  if (!siteUrl || !secret) return NextResponse.json({ error: "URL pública ou segredo do webhook ausente." }, { status: 500 });
  const citizen = db.prepare("SELECT phone_enc FROM citizens WHERE relationship_opt_in = 1 ORDER BY id DESC LIMIT 1").get() as { phone_enc: string } | undefined;
  if (!citizen) return NextResponse.json({ error: "Crie primeiro uma indicação de teste com autorização de mensagens." }, { status: 409 });
  const number = decryptCitizenValue(citizen.phone_enc).replace(/\D/g, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${siteUrl}/api/webhooks/evolution?secret=${encodeURIComponent(secret)}`, {
      method: "POST",
      cache: "no-store",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "messages.upsert",
        instance: process.env.EVOLUTION_INSTANCE || "gabinete",
        data: {
          key: { remoteJid: `${number}@s.whatsapp.net`, fromMe: false, id: `receiver-test-${Date.now()}` },
          message: { conversation: "[TESTE INTERNO] Receptor do webhook funcionando." },
          messageType: "conversation",
        },
      }),
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`O receptor respondeu HTTP ${response.status}: ${text.slice(0, 180)}`);
    return NextResponse.json({ message: "Teste recebido pelo endpoint público. Atualize o painel para ver o registro." });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "O endpoint público demorou mais de 8 segundos para responder."
      : error instanceof Error ? error.message : "Falha no teste do receptor.";
    console.error("Evolution receiver self-test failed", error);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
