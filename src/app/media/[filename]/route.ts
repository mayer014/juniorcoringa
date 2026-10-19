import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;
  if (!/^[a-z0-9-]+\.webp$/i.test(filename)) return new NextResponse("Not found", { status: 404 });
  const dataDir = path.resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"),
  );
  try {
    const file = await fs.readFile(path.join(dataDir, "uploads", filename));
    return new NextResponse(file, { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
