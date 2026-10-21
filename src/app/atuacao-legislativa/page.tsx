import type { Metadata } from "next";
import { CheckCircle2, Clock3, FileCheck2, Landmark, Search } from "lucide-react";
import Link from "next/link";
import { LegislativeCard } from "@/components/legislative-card";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { countLegislativeItems, getLegislativeCounts, listLegislativeItems, listLegislativeYears } from "@/lib/db";
import type { LegislativeKind, LegislativeStatusGroup } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Atuação legislativa",
  description: "Acompanhe indicações, projetos em tramitação e leis aprovadas do vereador Junior Coringa.",
};

const PAGE_SIZE = 24;
type SearchParams = { tipo?: string; situacao?: string; ano?: string; q?: string; pagina?: string };
type PageProps = { searchParams: Promise<SearchParams> };

function pageHref(filters: SearchParams, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && key !== "pagina") params.set(key, value);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return `/atuacao-legislativa${query ? `?${query}` : ""}`;
}

export default async function LegislativePage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const kind = filters.tipo === "projetos" ? "project" : filters.tipo === "indicacoes" ? "indication" : undefined;
  const statusGroup = ["processing", "approved", "archived"].includes(filters.situacao ?? "")
    ? filters.situacao as LegislativeStatusGroup
    : undefined;
  const parsedYear = Number.parseInt(filters.ano ?? "", 10);
  const year = Number.isFinite(parsedYear) ? parsedYear : undefined;
  const requestedPage = Number.parseInt(filters.pagina ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const query = filters.q?.trim() || undefined;
  const listOptions = { kind: kind as LegislativeKind | undefined, statusGroup, year, query };
  const total = countLegislativeItems(listOptions);
  const pageCount = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const safePage = Math.min(page, pageCount);
  const items = listLegislativeItems({ ...listOptions, limit: PAGE_SIZE, offset: (safePage - 1) * PAGE_SIZE });
  const counts = getLegislativeCounts();
  const years = listLegislativeYears();
  const featuredLaws = listLegislativeItems({ kind: "project", statusGroup: "approved", limit: 40 })
    .filter((item) => item.lawUrl)
    .slice(0, 3);
  const hasFilters = Boolean(filters.tipo || filters.situacao || filters.ano || query);

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

        {!hasFilters && featuredLaws.length > 0 && (
          <section className="legislative-featured">
            <div className="shell">
              <div className="legislative-featured__heading">
                <div><span>Resultados do mandato</span><h2>Leis e atos aprovados</h2></div>
                <Link href="/atuacao-legislativa?tipo=projetos&situacao=approved">Ver todos os aprovados</Link>
              </div>
              <div className="legislative-grid">{featuredLaws.map((item) => <LegislativeCard key={item.id} item={item} />)}</div>
            </div>
          </section>
        )}

        <section className="section legislative-list-section">
          <div className="shell">
            <form className="legislative-filters" action="/atuacao-legislativa">
              <label className="legislative-search"><span>Buscar por bairro, rua ou assunto</span><span className="legislative-search__field"><Search size={16} /><input name="q" defaultValue={filters.q ?? ""} placeholder="Ex.: Jardim Paulo Coelho" /></span></label>
              <label>Tipo<select name="tipo" defaultValue={filters.tipo ?? ""}><option value="">Todos</option><option value="indicacoes">Indicações</option><option value="projetos">Projetos</option></select></label>
              <label>Situação<select name="situacao" defaultValue={filters.situacao ?? ""}><option value="">Todas</option><option value="processing">Em tramitação</option><option value="approved">Aprovados</option><option value="archived">Arquivados</option></select></label>
              <label>Ano<select name="ano" defaultValue={filters.ano ?? ""}><option value="">Todos</option>{years.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
              <button className="button button--small" type="submit">Filtrar</button>
              {hasFilters && <Link href="/atuacao-legislativa" className="legislative-clear">Limpar</Link>}
            </form>

            <div className="legislative-results-heading"><div><Landmark size={21} /><strong>{total}</strong> registros encontrados</div><span>Fonte: Câmara Municipal de Campo Grande/MS</span></div>
            {items.length ? <div className="legislative-grid">{items.map((item) => <LegislativeCard key={item.id} item={item} />)}</div> : <div className="news-empty"><div className="news-empty__mark"><Landmark /></div><div><span>Nenhum resultado</span><h3>Não encontramos registros com esses filtros.</h3><p>Altere os filtros ou consulte novamente após a próxima sincronização.</p></div></div>}
            {pageCount > 1 && (
              <nav className="legislative-pagination" aria-label="Paginação dos registros">
                {safePage > 1 ? <Link href={pageHref(filters, safePage - 1)}>← Anterior</Link> : <span />}
                <strong>Página {safePage} de {pageCount}</strong>
                {safePage < pageCount ? <Link href={pageHref(filters, safePage + 1)}>Próxima →</Link> : <span />}
              </nav>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
