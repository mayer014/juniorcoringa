import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { addCitizenRequestAttachment, countRecentCitizenRequestsByIp, createCitizenRequest } from "@/lib/citizen-requests";
import { hashCitizenValue } from "@/lib/citizen-privacy";
import { isSameOrigin, validateCitizenRequestInput } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

function text(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
}

function getIpHash(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return hashCitizenValue(forwarded || request.headers.get("x-real-ip") || "unknown");
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inv\u00e1lida." }, { status: 403 });

  try {
    const form = await request.formData();
    if (text(form, "website")) return NextResponse.json({ ok: true }, { status: 201 });

    const ipHash = getIpHash(request);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    if (countRecentCitizenRequestsByIp(ipHash, since) >= 5) {
      return NextResponse.json({ error: "Limite de envios atingido. Aguarde uma hora antes de tentar novamente." }, { status: 429 });
    }

    const parsed = validateCitizenRequestInput({
      fullName: text(form, "fullName"), phone: text(form, "phone"), birthDate: text(form, "birthDate"),
      postalCode: text(form, "postalCode"), street: text(form, "street"), addressNumber: text(form, "addressNumber"),
      addressComplement: text(form, "addressComplement"), neighborhood: text(form, "neighborhood"),
      city: text(form, "city"), state: text(form, "state"), category: text(form, "category"),
      problemPostalCode: text(form, "problemPostalCode"), problemStreet: text(form, "problemStreet"),
      problemNumber: text(form, "problemNumber"), problemNeighborhood: text(form, "problemNeighborhood"),
      problemCity: text(form, "problemCity"), problemReference: text(form, "problemReference"),
      description: text(form, "description"), urgent: text(form, "urgent") === "true",
      privacyAccepted: text(form, "privacyAccepted") === "true",
      relationshipConsent: text(form, "relationshipConsent") === "true",
      utmSource: text(form, "utmSource"), utmMedium: text(form, "utmMedium"),
      utmCampaign: text(form, "utmCampaign"), utmContent: text(form, "utmContent"),
      referrer: text(form, "referrer"),
    });
    if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const photos = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    if (photos.length > MAX_PHOTOS) return NextResponse.json({ error: "Envie no m\u00e1ximo 3 fotos." }, { status: 400 });
    for (const photo of photos) {
      if (!acceptedTypes.has(photo.type) || photo.size > MAX_PHOTO_BYTES) {
        return NextResponse.json({ error: "Cada foto deve ser JPG, PNG ou WebP e ter no m\u00e1ximo 8 MB." }, { status: 400 });
      }
    }

    const created = createCitizenRequest(parsed.data, ipHash);
    const dataDir = path.resolve(
      /* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"),
    );
    const uploadDir = path.join(dataDir, "request-uploads", String(created.id));
    const warnings: string[] = [];
    if (photos.length) {
      await fs.mkdir(uploadDir, { recursive: true });
      for (const photo of photos) {
        try {
          const filename = `${randomUUID()}.webp`;
          const outputPath = path.join(uploadDir, filename);
          await sharp(Buffer.from(await photo.arrayBuffer()))
            .rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
            .webp({ quality: 82 }).toFile(outputPath);
          addCitizenRequestAttachment(created.id, filename);
        } catch {
          warnings.push(photo.name);
        }
      }
    }

    return NextResponse.json({
      protocol: created.protocol,
      trackingUrl: `/acompanhar/${created.trackingToken}`,
      warning: warnings.length ? "A solicita\u00e7\u00e3o foi recebida, mas uma ou mais fotos n\u00e3o puderam ser anexadas." : null,
    }, { status: 201 });
  } catch (error) {
    console.error("Citizen request submission failed", error);
    return NextResponse.json({ error: "N\u00e3o foi poss\u00edvel enviar agora. Tente novamente em alguns minutos." }, { status: 500 });
  }
}
