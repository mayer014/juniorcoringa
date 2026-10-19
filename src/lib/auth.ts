import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const COOKIE_NAME = "jc_admin_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  email: string;
  exp: number;
};

function getSessionSecret() {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET não configurado.");
  }
  return "development-only-secret-change-in-production";
}

function encodePayload(payload: SessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function verifyCredentials(email: string, password: string) {
  const expectedEmail = (process.env.ADMIN_EMAIL || "admin@juniorcoringa.com.br").toLowerCase();
  const emailMatches = safeEqual(email.trim().toLowerCase(), expectedEmail);
  if (!emailMatches) return false;

  if (process.env.ADMIN_PASSWORD_HASH) {
    return bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH);
  }

  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (!configuredPassword) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ADMIN_PASSWORD ou ADMIN_PASSWORD_HASH não configurado.");
    }
    return safeEqual(password, "troque-esta-senha");
  }

  return safeEqual(password, configuredPassword);
}

export function createSessionToken(email: string) {
  const payload = encodePayload({
    email,
    exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  });
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(sign(payload), signature)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionPayload;
    if (!decoded.email || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export async function setSession(email: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(email), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", { httpOnly: true, maxAge: 0, path: "/" });
}

export async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(COOKIE_NAME)?.value);
}

export async function requireAdmin() {
  const session = await getSession();
  if (!session) redirect("/admin/login");
  return session;
}
