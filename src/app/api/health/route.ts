import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const RELEASE = "2026-10-27-canonical-news-fallback-v11";

export function GET() {
  try {
    db.prepare("SELECT 1").get();
    return NextResponse.json({ status: "ok", service: "junior-coringa", database: "ok", release: RELEASE });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", service: "junior-coringa", database: "unavailable", release: RELEASE },
      { status: 503 },
    );
  }
}
