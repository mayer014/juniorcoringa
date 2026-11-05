"use client";

import { ArchiveRestore, History, Newspaper, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CamaraSyncMode, CamaraSyncResult } from "@/lib/camara-sync";

async function requestSync(mode: CamaraSyncMode, phase?: "discover" | "enrich", sourceId?: string, apiPage?: number, previousApiPageKey?: string, scope: "updates" | "history" = "updates", resetHistory = false) {
  const response = await fetch("/api/admin/camara/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, phase, sourceId, apiPage, previousApiPageKey, scope, resetHistory }),
  });
  const rawPayload = await response.text();
  let payload: { error?: string; result?: CamaraSyncResult };
  try {
    payload = JSON.parse(rawPayload) as typeof payload;
  } catch {
    throw new Error(`O servidor interrompeu a consulta (HTTP ${response.status}). O progresso salvo será retomado na próxima importação.`);
  }
  if (!response.ok || !payload.result) throw new Error(payload.error || "Não foi possível sincronizar.");
  return payload.result;
}

export function CamaraSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState<"daily" | "history" | "indications" | "news" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const stopRequested = useRef(false);
  const [stopping, setStopping] = useState(false);
  const [sourcesMessage, setSourcesMessage] = useState("");
  const [newsScope, setNewsScope] = useState<"updates" | "history">("updates");

  async function importNews(scope: "updates" | "history", resetHistory = false) {
    setMessage(scope === "updates" ? "Buscando novidades e retomando pendências..." : "Retomando a recuperação de notícias antigas...");
    let result = await requestSync("news", "discover", undefined, undefined, undefined, scope, resetHistory);
    const sourceReports = [...(result.newsSources || [])];
    const pageKeys = new Set<string>();
    let checkedPages = 1;
    while (result.newsNextApiPage && !stopRequested.current && checkedPages < 200) {
      if (result.newsApiPageKey && pageKeys.has(result.newsApiPageKey)) break;
      if (result.newsApiPageKey) pageKeys.add(result.newsApiPageKey);
      setMessage(`${scope === "updates" ? "Buscando novidades" : "Recuperando histórico antigo"}, página ${result.newsNextApiPage}... ${result.newsKnown || 0} matérias identificadas.`);
      result = await requestSync("news", "discover", undefined, result.newsNextApiPage, result.newsApiPageKey, scope);
      checkedPages += 1;
      sourceReports.push(...(result.newsSources || []));
    }
    const historyComplete = Boolean(result.newsHistoryComplete);
    const labels = { archive: "página do vereador", api: "API oficial", rss: "RSS recente", recovery: "acervo de recuperação" };
    const used = [...new Set(sourceReports.filter((entry) => entry.status === "ok" && entry.found > 0).map((entry) => labels[entry.source]))];
    const unavailable = [...new Set(sourceReports.filter((entry) => entry.status === "unavailable").map((entry) => `${labels[entry.source]}: ${entry.message}`))];
    setSourcesMessage(`${used.length ? `Fontes utilizadas: ${used.join(", ")}.` : "Nenhuma fonte retornou novas matérias."}${unavailable.length ? ` Fontes indisponíveis: ${unavailable.join("; ")}` : ""}`);
    const queue = result.newsQueueIds || [];
    const known = result.newsKnown || result.newsFound || queue.length;
    let inserted = 0;
    let updated = 0;
    let processed = 0;
    const errors: string[] = [];
    for (const sourceId of queue) {
      if (stopRequested.current) break;
      setMessage(`${known} matérias identificadas. Recuperando ${processed + 1} de ${queue.length}... ${inserted} novas e ${updated} atualizadas.`);
      result = await requestSync("news", "enrich", sourceId, undefined, undefined, scope);
      inserted += result.newsInserted;
      updated += result.newsUpdated;
      errors.push(...(result.newsErrors || []));
      processed += 1;
      router.refresh();
    }
    const waiting = result.newsPending + result.newsFailed;
    setError(errors.length > 0 || (!historyComplete && known === 0));
    setMessage(`${stopRequested.current ? "Importação pausada." : "Consulta concluída."} ${inserted} matérias novas, ${updated} atualizadas e ${result.newsComplete} completas no total.${!historyComplete ? scope === "history" ? " A próxima recuperação continua da página salva, sem reiniciar o histórico." : " A consulta de novidades não pôde ser concluída; o ponto de atualização anterior foi preservado." : ""}${waiting ? ` ${waiting} aguardam recuperação; o próximo clique retoma a fila.` : ""}${errors.length ? ` Última falha: ${errors.at(-1)}` : ""}`);
  }

  async function synchronize(mode: "daily" | "history" | "indications" | "news", scope: "updates" | "history" = "updates", resetHistory = false) {
    setLoading(mode);
    setMessage("");
    setError(false);
    setSourcesMessage("");
    setNewsScope(scope);
    stopRequested.current = false;
    setStopping(false);
    try {
      if (mode === "news") {
        await importNews(scope, resetHistory);
        return;
      }
      const payload = { result: await requestSync(mode) };
      const successMessage = mode === "history"
        ? `${payload.result.inserted} leis históricas novas, ${payload.result.updated} atualizadas e ${payload.result.retitled} títulos simplificados.`
        : mode === "indications"
          ? `${payload.result.inserted} indicações recuperadas, ${payload.result.updated} atualizadas, ${payload.result.enriched} completas, ${payload.result.pending} pendentes, ${payload.result.failed} com falha e ${payload.result.manualReview} para revisão.`
          : `${payload.result.inserted} novos registros, ${payload.result.updated} atualizados, ${payload.result.unchanged} preservados, ${payload.result.retitled} títulos simplificados, ${payload.result.newsInserted} novas matérias e ${payload.result.newsUpdated} matérias enriquecidas.`;
      const indicationPending = payload.result.pending + payload.result.failed + payload.result.manualReview;
      const newsWaiting = payload.result.newsPending + payload.result.newsFailed;
      const pendingMessage = newsWaiting
        ? ` A fila possui ${payload.result.newsPending} pendentes e ${payload.result.newsFailed} com falha; elas continuarão disponíveis para novas tentativas.`
        : "";
      const indicationMessage = indicationPending ? ` ${indicationPending} indicações aguardam enriquecimento ou revisão no painel.` : "";
      setError(newsWaiting > 0 || indicationPending > 0);
      setMessage(`${successMessage}${pendingMessage}${indicationMessage}`);
      router.refresh();
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : "Falha na sincronização.");
    } finally {
      setLoading(null);
      setStopping(false);
      router.refresh();
    }
  }

  return (
    <div className="camara-sync-action">
      <div className="camara-sync-buttons">
        <button className="admin-button admin-button--primary" type="button" onClick={() => synchronize("daily")} disabled={Boolean(loading)}>
          <RefreshCw size={18} className={loading === "daily" ? "spin" : undefined} />
          {loading === "daily" ? "Sincronizando..." : "Sincronizar agora"}
        </button>
        <button className="admin-button admin-button--secondary" type="button" onClick={() => synchronize("history")} disabled={Boolean(loading)}>
          <History size={18} className={loading === "history" ? "spin" : undefined} />
          {loading === "history" ? "Importando histórico..." : "Importar histórico de leis"}
        </button>
        <button className="admin-button admin-button--secondary" type="button" onClick={() => synchronize("news")} disabled={Boolean(loading)}>
          <Newspaper size={18} className={loading === "news" ? "spin" : undefined} />
          {loading === "news" ? newsScope === "updates" ? "Atualizando notícias..." : "Recuperando histórico..." : "Atualizar notícias"}
        </button>
        <button className="admin-button admin-button--secondary" type="button" onClick={() => synchronize("indications")} disabled={Boolean(loading)}>
          <ArchiveRestore size={18} className={loading === "indications" ? "spin" : undefined} />
          {loading === "indications" ? "Recuperando indicações..." : "Restaurar histórico de indicações"}
        </button>
      </div>
      <details className="camara-news-recovery-options">
        <summary>Recuperação de notícias antigas</summary>
        <div className="camara-sync-buttons">
          <button className="admin-button admin-button--secondary" type="button" disabled={Boolean(loading)} onClick={() => synchronize("news", "history")}>Continuar recuperação antiga</button>
          <button className="admin-button admin-button--secondary" type="button" disabled={Boolean(loading)} onClick={() => synchronize("news", "history", true)}>Revisar todo o histórico desde o início</button>
        </div>
      </details>
      {loading === "news" && <button className="admin-button admin-button--secondary" type="button" disabled={stopping} onClick={() => { stopRequested.current = true; setStopping(true); }}>{stopping ? "Finalizando matéria atual..." : "Pausar importação"}</button>}
      {message && <p className={error ? "camara-sync-message is-error" : "camara-sync-message"}>{message}</p>}
      {sourcesMessage && <p className="camara-sync-message">{sourcesMessage}</p>}
    </div>
  );
}
