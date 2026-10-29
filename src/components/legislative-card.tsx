import { ArrowUpRight, CheckCircle2, Clock3, FileCheck2, Star } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import type { LegislativeItem } from "@/lib/types";

const statusLabels = {
  processing: "Em tramitação",
  approved: "Aprovado",
  archived: "Arquivado",
  protocolled: "Protocolada",
};

export function LegislativeCard({ item }: { item: LegislativeItem }) {
  const Icon = item.kind === "indication" ? FileCheck2 : item.statusGroup === "approved" ? CheckCircle2 : Clock3;
  return (
    <article className={`legislative-card legislative-card--${item.kind}${item.featured ? " legislative-card--featured" : ""}`}>
      <div className="legislative-card__top">
        <span className="legislative-card__icon"><Icon size={19} /></span>
        <span className={`legislative-status legislative-status--${item.statusGroup}`}>{statusLabels[item.statusGroup]}</span>
      </div>
      {item.featured && <span className="legislative-card__featured"><Star size={13} fill="currentColor" /> Projeto em destaque</span>}
      <span className="legislative-card__type">{item.type} · {formatDate(item.occurredAt, "short")}</span>
      {item.neighborhood && <span className="legislative-card__place">{item.neighborhood}</span>}
      <h3><Link href={`/atuacao-legislativa/${item.id}`}>{item.title}</Link></h3>
      <p>{item.publicSummary}</p>
      {item.lawNumber && <span className="legislative-card__law"><CheckCircle2 size={15} /> {item.lawNumber}</span>}
      <Link className="text-link" href={`/atuacao-legislativa/${item.id}`}>Ver detalhes <ArrowUpRight size={17} /></Link>
    </article>
  );
}
