import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEvolutionConnectionState } from "@/lib/evolution";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getSession())) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const result = await getEvolutionConnectionState();
  return NextResponse.json(result, { status: result.error ? 502 : 200 });
}
