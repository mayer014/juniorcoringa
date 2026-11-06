import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from "node:crypto";

function dataSecret() {
  const secret = process.env.CITIZEN_DATA_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") throw new Error("CITIZEN_DATA_SECRET ou SESSION_SECRET n\u00e3o configurado.");
    return "development-citizen-data-secret-change-me";
  }
  return secret;
}

function encryptionKey() {
  return createHash("sha256").update(`citizen-encryption:${dataSecret()}`).digest();
}

export function encryptCitizenValue(value: string | null | undefined) {
  if (!value) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCitizenValue(value: string | null | undefined) {
  if (!value) return "";
  if (!value.startsWith("v1.")) return value;
  const [, iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Dado pessoal criptografado inv\u00e1lido.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function hashCitizenValue(value: string) {
  return createHmac("sha256", dataSecret()).update(value).digest("hex");
}

export function normalizePhone(value: string) {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return (digits.length === 12 || digits.length === 13) && digits.startsWith("55") ? `+${digits}` : "";
}

export function trackingTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
