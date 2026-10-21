import { Activity, CheckCircle2, Clock3, FileCheck2, Landmark, Newspaper } from "lucide-react";
import { CamaraSyncButton } from "@/components/admin/camara-sync-button";
import { getLatestCamaraSyncRun, getLegislativeCounts } from "@/lib/db";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function IntegrationPage() {
  const counts = getLegislativeCounts();
  const latest = getLatestCamaraSyncRun();

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
    </div>
  );
}
