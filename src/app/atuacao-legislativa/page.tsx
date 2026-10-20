import type { Metadata } from "next";
import { CheckCircle2, Clock3, FileCheck2, Landmark } from "lucide-react";
import Link from "next/link";
import { LegislativeCard } from "@/components/legislative-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getLegislativeCounts, listLegislativeItems } from "@/lib/db";
import type { LegislativeKind, LegislativeStatusGroup } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Atuação legislativa",
  description: "Acompanhe indicações, projetos em tramitação e projetos aprovados do vereador Junior Coringa.",
};

type PageProps = { searchParams: Promise<{ tipo?: string; situacao?: string; ano?: string }> };

export default async function LegislativePage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const kind = filters.tipo === "projetos" ? "project" : filters.tipo === "indicacoes" ? "indication" : undefined;
  const statusGroup = ["processing", "approved", "archived"].includes(filters.situacao ?? "")
    ? filters.situacao as LegislativeStatusGroup
    : undefined;
  const parsedYear = Number.parseInt(filters.ano ?? "", 10);
  const year = Number.isFinite(parsedYear) ? parsedYear : undefined;
  const items = listLegislativeItems({ kind: kind as LegislativeKind | undefined, statusGroup, year, limit: 500 });
  const counts = getLegislativeCounts();
  const years = [...new Set(listLegislativeItems({ limit: 500 }).map((item) => item.year))].sort((a, b) => b - a);

  return (
    <>
      <SiteHeader />
      <main className="legislative-page">
        <header className="legislative-hero">
          <div className="shell">
            <div className="eyebrow"><span /> Transparência do mandato</div>
            <h1>Atuação <em>legislativa</em></h1>
            <p>Dados oficiais sobre indicações, projetos e resultados do trabalho de Junior Coringa na Câmara Municipal.</p>
            <div className="legislative-summary">
              <article><FileCheck2 /><strong>{counts.indications}</strong><span>Indicações</span></article>
              <article><Clock3 /><strong>{counts.processing}</strong><span>Em tramitação</span></article>
              <article><CheckCircle2 /><strong>{counts.approved}</strong><span>Aprovados</span></article>
            </div>
          </div>
        </header>

        <section className="section legislative-list-section">
          <div className="shell">
            <form className="legislative-filters" action="/atuacao-legislativa">
              <label>Tipo<select name="tipo" defaultValue={filters.tipo ?? ""}><option value="">Todos</option><option value="indicacoes">Indicações</option><option value="projetos">Projetos</option></select></label>
              <label>Situação<select name="situacao" defaultValue={filters.situacao ?? ""}><option value="">Todas</option><option value="processing">Em tramitação</option><option value="approved">Aprovados</option><option value="archived">Arquivados</option></select></label>
              <label>Ano<select name="ano" defaultValue={filters.ano ?? ""}><option value="">Todos</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <button className="button button--small" type="submit">Filtrar</button>
              {(filters.tipo || filters.situacao || filters.ano) && <Link href="/atuacao-legislativa" className="legislative-clear">Limpar</Link>}
            </form>

            <div className="legislative-results-heading"><div><Landmark size={21} /><strong>{items.length}</strong> registros encontrados</div><span>Fonte: Câmara Municipal de Campo Grande/MS</span></div>
            {items.length ? <div className="legislative-grid">{items.map((item) => <LegislativeCard key={item.id} item={item} />)}</div> : <div className="news-empty"><div className="news-empty__mark"><Landmark /></div><div><span>Nenhum resultado</span><h3>Não encontramos registros com esses filtros.</h3><p>Altere os filtros ou consulte novamente após a próxima sincronização.</p></div></div>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
