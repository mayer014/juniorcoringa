import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCitizenRequestAttachment } from "@/lib/citizen-requests";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; attachmentId: string }> }) {
  if (!(await getSession())) return new NextResponse("N\u00e3o autorizado", { status: 401 });
  const { id, attachmentId } = await params;
  const attachment = getCitizenRequestAttachment(Number(id), Number(attachmentId));
  if (!attachment || !/^[a-f0-9-]+\.webp$/i.test(attachment.filename)) return new NextResponse("N\u00e3o encontrado", { status: 404 });
  const dataDir = path.resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"),
  );
  try {
    const file = await fs.readFile(path.join(dataDir, "request-uploads", String(Number(id)), attachment.filename));
    return new NextResponse(file, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" } });
  } catch { return new NextResponse("N\u00e3o encontrado", { status: 404 }); }
}
