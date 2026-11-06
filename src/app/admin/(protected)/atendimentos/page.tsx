import Link from "next/link";
import { AlertTriangle, Clock3, Download, Inbox, Search, Send, SquareCheckBig } from "lucide-react";
import { citizenRequestCategoryLabels, citizenRequestStatusLabels } from "@/lib/citizen-request-labels";
import { getCitizenRequestCounts, listCitizenRequests } from "@/lib/citizen-requests";
import { formatDateTime } from "@/lib/format";
import { citizenRequestCategories, citizenRequestStatuses } from "@/lib/validation";
import type { CitizenRequestCategory, CitizenRequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;

export default async function RequestsAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const statusValue = first(params.status);
  const categoryValue = first(params.category);
  const query = first(params.q) || "";
  const status = citizenRequestStatuses.includes(statusValue as CitizenRequestStatus) ? statusValue as CitizenRequestStatus : undefined;
  const category = citizenRequestCategories.includes(categoryValue as CitizenRequestCategory) ? categoryValue as CitizenRequestCategory : undefined;
  const requests = listCitizenRequests({ status, category, query });
  const counts = getCitizenRequestCounts();
  const exportQuery = new URLSearchParams({ ...(status && { status }), ...(category && { category }), ...(query && { q: query }) }).toString();
  return <div className="admin-content request-admin-page">
    <div className="admin-page-header"><div><span>Escuta e encaminhamento</span><h1>Atendimentos</h1><p>Organize as indicações recebidas e acompanhe cada protocolo.</p></div><Link className="admin-button admin-button--secondary" href={`/api/admin/requests/export${exportQuery ? `?${exportQuery}` : ""}`}><Download size={17} /> Exportar CSV</Link></div>
    <div className="admin-stats admin-stats--request">
      <article><span><Inbox size={20} /></span><div><strong>{counts.total}</strong><small>Total</small></div></article>
      <article><span><Clock3 size={20} /></span><div><strong>{counts.pending}</strong><small>Pendentes</small></div></article>
      <article><span><Send size={20} /></span><div><strong>{counts.monitoring}</strong><small>Protocoladas</small></div></article>
      <article><span><SquareCheckBig size={20} /></span><div><strong>{counts.closed}</strong><small>Concluídas</small></div></article>
      <article><span><AlertTriangle size={20} /></span><div><strong>{counts.urgent}</strong><small>Urgentes</small></div></article>
    </div>
    <form className="request-admin-filters">
      <label><Search size={18} /><input name="q" defaultValue={query} placeholder="Protocolo, nome, telefone ou bairro" /></label>
      <select name="status" defaultValue={status || ""}><option value="">Todas as situações</option>{citizenRequestStatuses.map((value) => <option key={value} value={value}>{citizenRequestStatusLabels[value]}</option>)}</select>
      <select name="category" defaultValue={category || ""}><option value="">Todas as categorias</option>{citizenRequestCategories.map((value) => <option key={value} value={value}>{citizenRequestCategoryLabels[value]}</option>)}</select>
      <button className="admin-button admin-button--primary">Filtrar</button>
    </form>
    <section className="admin-list-card"><div className="admin-list-card__heading"><h2>Fila de solicitações</h2><span>{requests.length} {requests.length === 1 ? "registro" : "registros"}</span></div>
      {requests.length ? <div className="admin-table-wrap"><table className="admin-table request-admin-table"><thead><tr><th>Solicitação</th><th>Morador</th><th>Categoria</th><th>Situação</th><th>Recebida</th><th></th></tr></thead><tbody>{requests.map((item) => <tr key={item.id} className={item.urgent ? "is-urgent" : ""}><td><strong>{item.protocol}{item.urgent && <em>Urgente</em>}</strong><small>{item.problemNeighborhood} • {item.description}</small></td><td><strong>{item.fullName}</strong><small>{item.phone}</small></td><td><span className="category-chip">{citizenRequestCategoryLabels[item.category]}</span></td><td><span className={`request-status request-status--${item.status}`}>{citizenRequestStatusLabels[item.status]}</span></td><td>{formatDateTime(item.createdAt)}</td><td><Link className="admin-button admin-button--secondary" href={`/admin/atendimentos/${item.id}`}>Abrir</Link></td></tr>)}</tbody></table></div> : <div className="admin-empty"><span><Inbox size={28} /></span><h3>Nenhuma solicitação encontrada</h3><p>Ajuste os filtros ou aguarde novos envios pelo site.</p></div>}
    </section>
  </div>;
}
