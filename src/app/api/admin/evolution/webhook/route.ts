import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { configureEvolutionWebhook, getEvolutionWebhookState } from "@/lib/evolution";
import { isSameOrigin } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const result = await getEvolutionWebhookState();
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}

export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
    if (!(await getSession())) return NextResponse.json({ error: "Sua sessão expirou. Entre novamente no painel." }, { status: 401 });
    await configureEvolutionWebhook();
    return NextResponse.json({ message: "Webhook configurado. As respostas do WhatsApp agora poderão chegar ao painel." });
  } catch (error) {
    console.error("Evolution webhook configuration failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao configurar o webhook." }, { status: 502 });
  }
}
