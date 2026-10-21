import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteLegislativeItem, updateLegislativeVisibility } from "@/lib/db";
import { isSameOrigin } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function refreshLegislativePages() {
  revalidatePath("/");
  revalidatePath("/atuacao-legislativa");
  revalidatePath("/admin/integracao");
}

export async function PATCH(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  const body = await request.json().catch(() => null) as { published?: unknown } | null;
  if (!Number.isFinite(id) || typeof body?.published !== "boolean") {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const item = updateLegislativeVisibility(id, body.published);
  if (!item) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  refreshLegislativePages();
  return NextResponse.json({ item });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  if (!Number.isFinite(id)) return NextResponse.json({ error: "Registro inválido." }, { status: 400 });
  if (!deleteLegislativeItem(id)) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  refreshLegislativePages();
  return NextResponse.json({ ok: true });
}
