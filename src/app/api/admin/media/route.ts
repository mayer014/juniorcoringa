import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { isSameOrigin } from "@/lib/validation";

export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Selecione uma imagem." }, { status: 400 });
  if (!allowedTypes.has(file.type)) return NextResponse.json({ error: "Formato não permitido. Use JPG, PNG ou WebP." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "A imagem deve ter no máximo 8 MB." }, { status: 400 });

  try {
    const dataDir = path.resolve(
      /* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"),
    );
    const uploadDir = path.join(dataDir, "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    const output = path.join(uploadDir, filename);
    await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1800, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(output);
    return NextResponse.json({ url: `/media/${filename}` }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Não foi possível processar a imagem." }, { status: 400 });
  }
}
