import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteLegislativeItem, updateLegislativeFeatured, updateLegislativeReview, updateLegislativeVisibility } from "@/lib/db";
import { isSameOrigin, validateLegislativeReviewInput } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

function refreshLegislativePages(id?: number) {
  revalidatePath("/");
  revalidatePath("/atuacao-legislativa");
  revalidatePath("/admin/integracao");
  if (id) revalidatePath(`/atuacao-legislativa/${id}`);
}

export async function PATCH(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id: rawId } = await params;
  const id = Number.parseInt(rawId, 10);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!Number.isFinite(id) || !body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const item = typeof body.featured === "boolean"
    ? updateLegislativeFeatured(id, body.featured)
    : typeof body.published === "boolean" ? updateLegislativeVisibility(id, body.published)
    : (() => {
        const parsed = validateLegislativeReviewInput(body);
        if (!parsed.data) return parsed;
        return updateLegislativeReview(id, parsed.data);
      })();
  if (item && "error" in item) return NextResponse.json({ error: item.error }, { status: 400 });
  if (!item) return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  refreshLegislativePages(id);
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
