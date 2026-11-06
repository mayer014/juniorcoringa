import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { updateCitizenRequest } from "@/lib/citizen-requests";
import { isSameOrigin, validateCitizenRequestUpdate } from "@/lib/validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Origem inv\u00e1lida." }, { status: 403 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "N\u00e3o autorizado." }, { status: 401 });
  const parsed = validateCitizenRequestUpdate(await request.json());
  if (!parsed.data) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { id } = await params;
  const updated = updateCitizenRequest(Number(id), parsed.data, session.email);
  if (!updated) return NextResponse.json({ error: "Atendimento n\u00e3o encontrado." }, { status: 404 });
  revalidatePath("/admin/atendimentos");
  revalidatePath(`/admin/atendimentos/${id}`);
  return NextResponse.json({ request: updated });
}
