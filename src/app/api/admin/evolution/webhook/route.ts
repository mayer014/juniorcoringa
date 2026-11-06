import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { configureEvolutionWebhook } from "@/lib/evolution";
import { isSameOrigin } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    await configureEvolutionWebhook();
    return NextResponse.json({ message: "Webhook configurado. As respostas do WhatsApp agora poderão chegar ao painel." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Falha ao configurar o webhook." }, { status: 502 });
  }
}
