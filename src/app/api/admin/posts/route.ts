import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createPost } from "@/lib/db";
import { isSameOrigin, validatePostInput } from "@/lib/validation";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const parsed = validatePostInput(await request.json());
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  return NextResponse.json({ post: createPost(parsed.data) }, { status: 201 });
}
