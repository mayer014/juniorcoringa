import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncCamaraData } from "@/lib/camara-sync";
import { isSameOrigin } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const result = await syncCamaraData();
    revalidatePath("/");
    revalidatePath("/noticias");
    revalidatePath("/atuacao-legislativa");
    revalidatePath("/admin/integracao");
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("Sincronização manual da Câmara falhou:", error);
    const message = error instanceof Error ? error.message : "Falha na sincronização.";
    return NextResponse.json({ error: message }, { status: /andamento/i.test(message) ? 409 : 502 });
  }
}
