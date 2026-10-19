import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { deletePost, updatePost } from "@/lib/db";
import { isSameOrigin, validatePostInput } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const parsed = validatePostInput(await request.json());
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id } = await params;
  const post = updatePost(Number(id), parsed.data);
  if (!post) return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
  return NextResponse.json({ post });
}

export async function DELETE(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await params;
  const removed = deletePost(Number(id));
  if (!removed) return NextResponse.json({ error: "Publicação não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
