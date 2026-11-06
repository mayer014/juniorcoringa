import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { citizenRequestCategoryLabels, citizenRequestPublicStatusLabels } from "@/lib/citizen-request-labels";
import { getCitizenRequestByTrackingToken } from "@/lib/citizen-requests";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acompanhar indicação", robots: { index: false, follow: false } };

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,80}$/.test(token)) notFound();
  const request = getCitizenRequestByTrackingToken(token);
  if (!request) notFound();
  return <><SiteHeader /><main className="tracking-page"><section className="tracking-hero"><div className="shell"><div className="eyebrow"><span /> Acompanhamento</div><h1>Sua indicação está <em>{citizenRequestPublicStatusLabels[request.status]}</em></h1><p>Protocolo {request.protocol}</p></div></section><section className="section"><div className="shell tracking-layout"><div className="tracking-card"><div className="tracking-card__status"><span><Clock3 size={24} /></span><div><small>Situação atual</small><strong>{citizenRequestPublicStatusLabels[request.status]}</strong></div></div><dl><div><dt>Assunto</dt><dd>{citizenRequestCategoryLabels[request.category]}</dd></div><div><dt>Bairro</dt><dd>{request.problemNeighborhood}</dd></div><div><dt>Recebida em</dt><dd>{formatDateTime(request.createdAt)}</dd></div>{request.officialProtocol && <div><dt>Protocolo no órgão</dt><dd>{request.officialProtocol}</dd></div>}</dl></div><div className="tracking-timeline"><h2>Histórico</h2>{request.history.map((entry, index) => <article key={`${entry.status}-${entry.createdAt}`}><span>{index === 0 ? <CheckCircle2 /> : <Circle />}</span><div><strong>{citizenRequestPublicStatusLabels[entry.status]}</strong><small>{formatDateTime(entry.createdAt)}</small></div></article>)}</div></div></section></main><SiteFooter /></>;
}
