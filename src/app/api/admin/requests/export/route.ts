import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { citizenRequestCategoryLabels, citizenRequestStatusLabels } from "@/lib/citizen-request-labels";
import { listCitizenRequests } from "@/lib/citizen-requests";
import { citizenRequestCategories, citizenRequestStatuses } from "@/lib/validation";
import type { CitizenRequestCategory, CitizenRequestStatus } from "@/lib/types";

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "N\u00e3o autorizado." }, { status: 401 });
  const url = new URL(request.url);
  const rawStatus = url.searchParams.get("status");
  const rawCategory = url.searchParams.get("category");
  const rows = listCitizenRequests({
    status: citizenRequestStatuses.includes(rawStatus as CitizenRequestStatus) ? rawStatus as CitizenRequestStatus : undefined,
    category: citizenRequestCategories.includes(rawCategory as CitizenRequestCategory) ? rawCategory as CitizenRequestCategory : undefined,
    query: url.searchParams.get("q") || undefined, limit: 5000,
  });
  const header = ["Protocolo", "Nome", "Telefone", "Bairro residencial", "Categoria", "Bairro do problema", "Descri\u00e7\u00e3o", "Urgente", "Situa\u00e7\u00e3o", "Respons\u00e1vel", "Protocolo oficial", "Recebida em"];
  const body = rows.map((item) => [item.protocol, item.fullName, item.phone, item.neighborhood, citizenRequestCategoryLabels[item.category], item.problemNeighborhood, item.description, item.urgent ? "Sim" : "N\u00e3o", citizenRequestStatusLabels[item.status], item.assignedTo, item.officialProtocol, item.createdAt]);
  const csv = `\uFEFF${[header, ...body].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
  return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="atendimentos-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" } });
}
