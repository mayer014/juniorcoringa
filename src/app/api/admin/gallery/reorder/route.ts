import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reorderGalleryItems } from "@/lib/db";
import { isSameOrigin } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const body = await request.json() as { ids?: unknown };
  if (!Array.isArray(body.ids) || body.ids.some((id) => !Number.isInteger(id) || Number(id) < 1)) {
    return NextResponse.json({ error: "Ordem inválida." }, { status: 400 });
  }
  reorderGalleryItems(body.ids.map(Number));
  return NextResponse.json({ ok: true });
}
