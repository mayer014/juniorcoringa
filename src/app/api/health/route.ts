import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export function GET() {
  try {
    db.prepare("SELECT 1").get();
    return NextResponse.json({ status: "ok", service: "junior-coringa", database: "ok" });
  } catch (error) {
    console.error("Health check failed:", error);
    return NextResponse.json(
      { status: "error", service: "junior-coringa", database: "unavailable" },
      { status: 503 },
    );
  }
}
