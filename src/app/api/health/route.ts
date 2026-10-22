import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const RELEASE = "2026-10-22-manual-sync-v7";

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
