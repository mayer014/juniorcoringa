import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deleteGalleryItem, updateGalleryItem } from "@/lib/db";
import { isSameOrigin, validateGalleryItemInput } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const parsed = validateGalleryItemInput(await request.json());
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id } = await params;
  const item = updateGalleryItem(Number(id), parsed.data);
  if (!item) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  return NextResponse.json({ item });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  if (!deleteGalleryItem(Number(id))) return NextResponse.json({ error: "Foto não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
