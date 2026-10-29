import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, CalendarDays, CheckCircle2, Landmark, MapPin, UserRound, Wrench } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLegislativeItem } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = getLegislativeItem(Number(id));
  return item ? { title: item.title, description: item.publicSummary } : { title: "Registro não encontrado" };
}

export default async function LegislativeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const item = getLegislativeItem(Number(id));
  if (!item) notFound();
  const mapQuery = item.location
    ? encodeURIComponent(`${item.location}${item.neighborhood ? `, ${item.neighborhood}` : ""}, Campo Grande, MS`)
    : null;
  return (
    <>
      <SiteHeader />
      <main className="legislative-detail">
        <div className="shell shell--article">
          <Link href="/atuacao-legislativa" className="back-link"><ArrowLeft size={17} /> Voltar para atuação legislativa</Link>
          <span className={`legislative-status legislative-status--${item.statusGroup}`}>{item.status}</span>
          <span className="legislative-detail__type">{item.type}</span>
          <h1>{item.title}</h1>
          {item.neighborhood && <span className="legislative-detail__neighborhood"><MapPin size={17} /> {item.neighborhood}</span>}
          <p className="legislative-detail__summary">{item.publicSummary}</p>
          <div className="legislative-detail__meta">
            <span><CalendarDays /> <small>Protocolado em</small><strong>{formatDate(item.occurredAt)}</strong></span>
            <span><UserRound /> <small>{item.authorRole ?? "Autoria"}</small><strong>{item.author}</strong></span>
            <span><Landmark /> <small>Situação atual</small><strong>{item.status}</strong></span>
          </div>
          {(item.service || item.location || item.neighborhood || item.reference) && (
            <section className="legislative-detail__request" aria-label="Detalhes da solicitação">
              {item.service && <div><Wrench /><span><small>O que foi solicitado</small><strong>{item.service}</strong></span></div>}
              {item.location && <div><MapPin /><span><small>Endereço</small><strong>{item.location}</strong>{mapQuery && <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer">Ver localização no mapa <ArrowUpRight size={14} /></a>}</span></div>}
              {item.neighborhood && <div><Landmark /><span><small>Bairro</small><strong>{item.neighborhood}</strong></span></div>}
              {item.reference && <div><MapPin /><span><small>Ponto de referência</small><strong>{item.reference}</strong></span></div>}
            </section>
          )}
          {item.lawNumber && (
            <section className="legislative-law-result">
              <CheckCircle2 />
              <div><small>Resultado oficial</small><h2>{item.lawNumber}</h2>{item.lawDate && <p>Publicada em {item.lawDate}</p>}</div>
              {item.lawUrl && <a href={item.lawUrl} target="_blank" rel="noopener noreferrer">Ler a lei consolidada <ArrowUpRight size={17} /></a>}
            </section>
          )}
          {item.fullText && (
            <section className="legislative-official-text">
              <span>Documento oficial</span>
              <h2>Texto completo da indicação</h2>
              <div>{item.fullText}</div>
            </section>
          )}
          <div className="legislative-source-note">
            <div><strong>Fonte oficial</strong><p>Registro importado do portal legislativo da Câmara Municipal de Campo Grande/MS. Número {item.number}/{item.year}.</p></div>
            <a className="button" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar documento oficial <ArrowUpRight size={18} /></a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
