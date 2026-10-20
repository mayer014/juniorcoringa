import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, CalendarDays, Landmark, UserRound } from "lucide-react";
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
  return item ? { title: item.title, description: item.summary } : { title: "Registro não encontrado" };
}

export default async function LegislativeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const item = getLegislativeItem(Number(id));
  if (!item) notFound();
  return (
    <>
      <SiteHeader />
      <main className="legislative-detail">
        <div className="shell shell--article">
          <Link href="/atuacao-legislativa" className="back-link"><ArrowLeft size={17} /> Voltar para atuação legislativa</Link>
          <span className={`legislative-status legislative-status--${item.statusGroup}`}>{item.status}</span>
          <span className="legislative-detail__type">{item.type}</span>
          <h1>{item.title}</h1>
          <p className="legislative-detail__summary">{item.summary}</p>
          <div className="legislative-detail__meta">
            <span><CalendarDays /> <small>Protocolado em</small><strong>{formatDate(item.occurredAt)}</strong></span>
            <span><UserRound /> <small>Autoria</small><strong>{item.author}</strong></span>
            <span><Landmark /> <small>Situação atual</small><strong>{item.status}</strong></span>
          </div>
          <div className="legislative-source-note">
            <div><strong>Fonte oficial</strong><p>Este registro foi importado do portal legislativo da Câmara Municipal de Campo Grande/MS.</p></div>
            <a className="button" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar na Câmara <ArrowUpRight size={18} /></a>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
