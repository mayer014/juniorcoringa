import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncCamaraData, type CamaraSyncMode, type CamaraNewsOptions } from "@/lib/camara-sync";
import { isSameOrigin } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  try {
    const body = await request.json().catch(() => null) as { mode?: unknown; phase?: unknown; sourceId?: unknown; apiPage?: unknown; previousApiPageKey?: unknown; scope?: unknown; resetHistory?: unknown } | null;
    const mode: CamaraSyncMode = body?.mode === "history"
      ? "history"
      : body?.mode === "indications"
        ? "indications"
        : body?.mode === "news" ? "news" : "daily";
    const newsOptions: CamaraNewsOptions = { phase: body?.phase === "enrich" ? "enrich" : "discover", scope: body?.scope === "history" ? "history" : "updates", resetHistory: body?.resetHistory === true };
    if (mode === "news" && body?.apiPage !== undefined) {
      if (typeof body.apiPage !== "number" || !Number.isInteger(body.apiPage) || body.apiPage < 1 || body.apiPage > 10000) {
        return NextResponse.json({ error: "Página inválida do histórico oficial." }, { status: 400 });
      }
      newsOptions.apiPage = body.apiPage;
      if (typeof body.previousApiPageKey === "string" && /^[a-f0-9]{64}$/.test(body.previousApiPageKey)) newsOptions.previousApiPageKey = body.previousApiPageKey;
    }
    if (mode === "news" && newsOptions.phase === "enrich") {
      if (typeof body?.sourceId !== "string" || !/^camara-news:\d+$/.test(body.sourceId)) {
        return NextResponse.json({ error: "Matéria inválida para recuperação." }, { status: 400 });
      }
      newsOptions.sourceId = body.sourceId;
    }
    const result = await syncCamaraData(mode, "manual", newsOptions);
    revalidatePath("/");
    revalidatePath("/noticias");
    revalidatePath("/atuacao-legislativa");
    revalidatePath("/admin/integracao");
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Sincronização manual da Câmara falhou:", error);
    const message = error instanceof Error ? error.message : "Falha na sincronização.";
    return NextResponse.json({ error: message }, { status: /andamento/i.test(message) ? 409 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
