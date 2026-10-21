import { Activity, CheckCircle2, Clock3, FileCheck2, Landmark, Newspaper, Search } from "lucide-react";
import Link from "next/link";
import { CamaraSyncButton } from "@/components/admin/camara-sync-button";
import { LegislativeManager } from "@/components/admin/legislative-manager";
import { countAdminLegislativeItems, getDatabaseStorageStatus, getLatestCamaraSyncRun, getLegislativeCounts, listAdminLegislativeItems } from "@/lib/db";
import { formatDate } from "@/lib/format";
import type { LegislativeKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
type SearchParams = { tipo?: string; exibicao?: string; q?: string; pagina?: string };
type PageProps = { searchParams: Promise<SearchParams> };

function pageHref(filters: SearchParams, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value && key !== "pagina") params.set(key, value);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return `/admin/integracao${query ? `?${query}` : ""}`;
}

export default async function IntegrationPage({ searchParams }: PageProps) {
  const filters = await searchParams;
  const counts = getLegislativeCounts();
  const latest = getLatestCamaraSyncRun();
  const storage = getDatabaseStorageStatus();
  const kind = filters.tipo === "projetos" ? "project" : filters.tipo === "indicacoes" ? "indication" : undefined;
  const visibility = filters.exibicao === "visiveis" ? "published" : filters.exibicao === "ocultos" ? "hidden" : undefined;
  const query = filters.q?.trim() || undefined;
  const requestedPage = Number.parseInt(filters.pagina ?? "1", 10);
  const page = Number.isFinite(requestedPage) ? Math.max(requestedPage, 1) : 1;
  const listOptions = { kind: kind as LegislativeKind | undefined, visibility: visibility as "published" | "hidden" | undefined, query };
  const totalManaged = countAdminLegislativeItems(listOptions);
  const pageCount = Math.max(Math.ceil(totalManaged / PAGE_SIZE), 1);
  const safePage = Math.min(page, pageCount);
  const items = listAdminLegislativeItems({ ...listOptions, limit: PAGE_SIZE, offset: (safePage - 1) * PAGE_SIZE });
  const hasFilters = Boolean(filters.tipo || filters.exibicao || query);

  return (
    <div className="admin-content">
      <div className="admin-page-header">
        <div>
          <span>Dados oficiais</span>
          <h1>Integração com a Câmara</h1>
          <p>A rotina diária consulta apenas o ano atual. O histórico completo de leis possui uma importação separada e não busca indicações antigas.</p>
        </div>
        <CamaraSyncButton />
      </div>

      {!storage.persistentMountDetected && <div className="admin-alert persistence-alert" role="alert"><strong>Volume persistente não detectado.</strong> Monte um volume do EasyPanel exatamente em <code>/app/data</code> antes de restaurar o histórico; sem isso, um novo deploy volta ao banco inicial da imagem.</div>}

      <div className="admin-stats admin-stats--four">
        <article><span><Landmark size={20} /></span><div><strong>{counts.total}</strong><small>Registros oficiais</small></div></article>
        <article><span><FileCheck2 size={20} /></span><div><strong>{counts.indications}</strong><small>Indicações</small></div></article>
        <article><span><Clock3 size={20} /></span><div><strong>{counts.processing}</strong><small>Em tramitação</small></div></article>
        <article><span><CheckCircle2 size={20} /></span><div><strong>{counts.approved}</strong><small>Aprovados</small></div></article>
      </div>

      <section className="admin-list-card camara-status-card">
        <div className="admin-list-card__heading"><h2>Última sincronização</h2><Activity size={20} /></div>
        {latest ? (
          <div className="camara-status-grid">
            <div><small>Início</small><strong>{formatDate(latest.startedAt)}</strong></div>
            <div><small>Situação</small><strong className={`sync-status sync-status--${latest.status}`}>{latest.status === "success" ? "Concluída" : latest.status === "running" ? "Em andamento" : "Erro"}</strong></div>
            <div><small>Encontrados</small><strong>{latest.found}</strong></div>
            <div><small>Novos</small><strong>{latest.inserted}</strong></div>
            <div><small>Atualizados</small><strong>{latest.updated}</strong></div>
            <div><small>Matérias novas</small><strong>{latest.newsInserted}</strong></div>
            {latest.error && <p className="camara-status-error">{latest.error}</p>}
          </div>
        ) : (
          <div className="admin-empty"><span><Newspaper size={28} /></span><h3>Aguardando a primeira sincronização</h3><p>Use o botão acima para importar agora ou aguarde a execução agendada.</p></div>
        )}
      </section>

      <section className="admin-list-card legislative-admin-manager">
        <div className="admin-list-card__heading"><h2>Registros da Câmara</h2><span>{totalManaged} encontrados · {PAGE_SIZE} por página</span></div>
        <form className="legislative-admin-filters" action="/admin/integracao">
          <label className="legislative-admin-search"><Search size={16} /><input name="q" defaultValue={filters.q ?? ""} placeholder="Buscar título, número, bairro ou lei" /></label>
          <select name="tipo" defaultValue={filters.tipo ?? ""} aria-label="Filtrar por tipo"><option value="">Todos os tipos</option><option value="indicacoes">Indicações</option><option value="projetos">Projetos e leis</option></select>
          <select name="exibicao" defaultValue={filters.exibicao ?? ""} aria-label="Filtrar por exibição"><option value="">Visíveis e ocultos</option><option value="visiveis">Somente visíveis</option><option value="ocultos">Somente ocultos</option></select>
          <button className="admin-button admin-button--primary" type="submit">Filtrar</button>
          {hasFilters && <Link className="legislative-admin-clear" href="/admin/integracao">Limpar</Link>}
        </form>
        <LegislativeManager initialItems={items} />
        {pageCount > 1 && <nav className="legislative-pagination legislative-admin-pagination" aria-label="Paginação dos registros administrativos">
          {safePage > 1 ? <Link href={pageHref(filters, safePage - 1)}>← Anterior</Link> : <span />}
          <strong>Página {safePage} de {pageCount}</strong>
          {safePage < pageCount ? <Link href={pageHref(filters, safePage + 1)}>Próxima →</Link> : <span />}
        </nav>}
      </section>
    </div>
  );
}
