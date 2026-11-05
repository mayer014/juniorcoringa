"use client";

import { ArchiveRestore, History, Newspaper, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { CamaraSyncMode, CamaraSyncResult } from "@/lib/camara-sync";

async function requestSync(mode: CamaraSyncMode, phase?: "discover" | "enrich", sourceId?: string) {
  const response = await fetch("/api/admin/camara/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, phase, sourceId }),
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

  async function importNews() {
    setMessage("Consultando o arquivo oficial de notícias...");
    let result = await requestSync("news", "discover");
    const queue = result.newsQueueIds || [];
    let inserted = 0;
    let updated = 0;
    let processed = 0;
    const errors: string[] = [];
    for (const sourceId of queue) {
      if (stopRequested.current) break;
      setMessage(`${result.newsFound || queue.length} matérias localizadas. Recuperando ${processed + 1} de ${queue.length}... ${inserted} novas e ${updated} atualizadas.`);
      result = await requestSync("news", "enrich", sourceId);
      inserted += result.newsInserted;
      updated += result.newsUpdated;
      errors.push(...(result.newsErrors || []));
      processed += 1;
      router.refresh();
    }
    const waiting = result.newsPending + result.newsFailed;
    setError(errors.length > 0);
    setMessage(`${stopRequested.current ? "Importação pausada." : "Consulta concluída."} ${inserted} matérias novas, ${updated} atualizadas e ${result.newsComplete} completas no total.${waiting ? ` ${waiting} aguardam recuperação; o próximo clique retoma a fila.` : ""}${errors.length ? ` Última falha: ${errors.at(-1)}` : ""}`);
  }

  async function synchronize(mode: "daily" | "history" | "indications" | "news") {
    setLoading(mode);
    setMessage("");
    setError(false);
    stopRequested.current = false;
    setStopping(false);
    try {
      if (mode === "news") {
        await importNews();
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
          {loading === "news" ? "Importando notícias..." : "Importar histórico de notícias"}
        </button>
        <button className="admin-button admin-button--secondary" type="button" onClick={() => synchronize("indications")} disabled={Boolean(loading)}>
          <ArchiveRestore size={18} className={loading === "indications" ? "spin" : undefined} />
          {loading === "indications" ? "Recuperando indicações..." : "Restaurar histórico de indicações"}
        </button>
      </div>
      {loading === "news" && <button className="admin-button admin-button--secondary" type="button" disabled={stopping} onClick={() => { stopRequested.current = true; setStopping(true); }}>{stopping ? "Finalizando matéria atual..." : "Pausar importação"}</button>}
      {message && <p className={error ? "camara-sync-message is-error" : "camara-sync-message"}>{message}</p>}
    </div>
  );
}
