import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Camera, MapPin, MessageCircle, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { CitizenRequestManager } from "@/components/admin/citizen-request-manager";
import { citizenRequestCategoryLabels, citizenRequestStatusLabels } from "@/lib/citizen-request-labels";
import { getCitizenRequest } from "@/lib/citizen-requests";
import { formatDate, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = getCitizenRequest(Number(id));
  if (!request) notFound();
  return <div className="admin-content request-detail-page">
    <div className="request-detail-top print-hide"><Link href="/admin/atendimentos"><ArrowLeft size={17} /> Voltar aos atendimentos</Link><span className={`request-status request-status--${request.status}`}>{citizenRequestStatusLabels[request.status]}</span></div>
    <header className="request-detail-header"><div><span>{request.protocol}</span><h1>{citizenRequestCategoryLabels[request.category]} em {request.problemNeighborhood}</h1><p>Recebida em {formatDateTime(request.createdAt)}</p></div>{request.urgent && <strong>Risco imediato informado</strong>}</header>
    <div className="request-detail-grid">
      <div className="request-detail-main">
        <section className="request-detail-card"><h2><MessageCircle size={20} /> Relato do morador</h2><p className="request-detail-description">{request.description}</p><dl><div><dt>Local do problema</dt><dd>{request.problemStreet}{request.problemNumber ? `, ${request.problemNumber}` : ""} — {request.problemNeighborhood}, {request.problemCity}</dd></div>{request.problemPostalCode && <div><dt>CEP</dt><dd>{request.problemPostalCode}</dd></div>}{request.problemReference && <div><dt>Referência</dt><dd>{request.problemReference}</dd></div>}</dl></section>
        {request.attachments.length > 0 && <section className="request-detail-card"><h2><Camera size={20} /> Fotos anexadas</h2><div className="request-attachments">{request.attachments.map((photo, index) => <a key={photo.id} href={`/api/admin/requests/${request.id}/attachments/${photo.id}`} target="_blank"><Image src={`/api/admin/requests/${request.id}/attachments/${photo.id}`} alt={`Foto ${index + 1} da solicitação`} width={420} height={280} unoptimized /></a>)}</div></section>}
        <CitizenRequestManager request={request} />
      </div>
      <aside className="request-detail-sidebar">
        <section className="request-detail-card"><h2><UserRound size={20} /> Dados do morador</h2><dl><div><dt>Nome</dt><dd>{request.fullName}</dd></div><div><dt>WhatsApp</dt><dd><a href={`https://wa.me/${request.phone.replace(/\D/g, "")}`} target="_blank">{request.phone}</a></dd></div><div><dt>Nascimento</dt><dd>{formatDate(`${request.birthDate}T12:00:00-04:00`)}</dd></div><div><dt>Endereço residencial</dt><dd>{request.street}, {request.addressNumber}{request.addressComplement ? ` — ${request.addressComplement}` : ""}<br />{request.neighborhood}, {request.city} — {request.state}<br />CEP {request.postalCode}</dd></div><div><dt>Mensagens autorizadas</dt><dd>{request.relationshipConsent ? "Sim, incluindo aniversário" : "Não"}</dd></div></dl></section>
        <section className="request-detail-card"><h2><CalendarDays size={20} /> Controle</h2><dl><div><dt>Responsável</dt><dd>{request.assignedTo || "Ainda não atribuído"}</dd></div><div><dt>Protocolo oficial</dt><dd>{request.officialProtocol || "Ainda não protocolado"}</dd></div><div><dt>Órgão</dt><dd>{request.officialDepartment || "—"}</dd></div><div><dt>Retorno de 30 dias</dt><dd>{formatDate(request.followUpDueAt)}</dd></div></dl></section>
        <section className="request-detail-card request-history"><h2><MapPin size={20} /> Histórico</h2>{request.history.map((entry) => <article key={entry.id}><span /><div><strong>{citizenRequestStatusLabels[entry.status]}</strong>{entry.note && <p>{entry.note}</p>}<small>{formatDateTime(entry.createdAt)} • {entry.actor}</small></div></article>)}</section>
      </aside>
    </div>
  </div>;
}
