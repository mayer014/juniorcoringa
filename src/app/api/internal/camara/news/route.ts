import { createHash, timingSafeEqual } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { createOfficialNewsPost } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.CAMARA_SYNC_SECRET || "";
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return Boolean(expected && supplied && left.length === right.length && timingSafeEqual(left, right));
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const payload = await request.json().catch(() => null) as { items?: unknown[] } | null;
  if (!payload?.items || !Array.isArray(payload.items) || payload.items.length > 20) {
    return NextResponse.json({ error: "Lote inválido." }, { status: 400 });
  }
  const dataDir = path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"));
  const uploadDir = path.join(dataDir, "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  const counts = { inserted: 0, updated: 0, unchanged: 0 };
  for (const raw of payload.items) {
    const item = raw as Record<string, unknown>;
    const sourceUrl = String(item.sourceUrl || "");
    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.hostname !== "www.camara.ms.gov.br") throw new Error("Fonte de notícia inválida.");
    const imageBase64 = String(item.imageBase64 || "");
    let coverImage: string | null = null;
    if (imageBase64) {
      const bytes = Buffer.from(imageBase64, "base64");
      if (bytes.length > 8 * 1024 * 1024) throw new Error("Imagem oficial excede 8 MB.");
      const filename = `camara-${createHash("sha256").update(sourceUrl).digest("hex").slice(0, 24)}.webp`;
      await sharp(bytes).rotate().resize({ width: 1800, height: 1200, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toFile(path.join(uploadDir, filename));
      coverImage = `/media/${filename}`;
    }
    const outcome = createOfficialNewsPost({
      sourceId: `camara-rss:${sourceUrl}`,
      sourceUrl,
      title: String(item.title || "").slice(0, 160),
      excerpt: String(item.excerpt || "").slice(0, 320),
      content: String(item.content || "").slice(0, 100_000),
      coverImage,
      publishedAt: new Date(String(item.publishedAt || "")).toISOString(),
    });
    counts[outcome] += 1;
  }
  revalidatePath("/");
  revalidatePath("/noticias");
  return NextResponse.json({ ok: true, counts });
}
