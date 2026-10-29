"use client";

import { ArchiveRestore, History, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CamaraSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState<"daily" | "history" | "indications" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function synchronize(mode: "daily" | "history" | "indications") {
    setLoading(mode);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/admin/camara/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const payload = await response.json() as {
        error?: string;
        result?: { inserted: number; updated: number; unchanged: number; newsInserted: number; newsUpdated: number; newsPending: number; retitled: number; enriched: number; pending: number; failed: number; manualReview: number };
      };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Não foi possível sincronizar.");
      const successMessage = mode === "history"
        ? `${payload.result.inserted} leis históricas novas, ${payload.result.updated} atualizadas e ${payload.result.retitled} títulos simplificados.`
        : mode === "indications"
          ? `${payload.result.inserted} indicações recuperadas, ${payload.result.updated} atualizadas, ${payload.result.enriched} completas, ${payload.result.pending} pendentes, ${payload.result.failed} com falha e ${payload.result.manualReview} para revisão.`
          : `${payload.result.inserted} novos registros, ${payload.result.updated} atualizados, ${payload.result.unchanged} preservados, ${payload.result.retitled} títulos simplificados, ${payload.result.newsInserted} novas matérias e ${payload.result.newsUpdated} matérias enriquecidas.`;
      const indicationPending = payload.result.pending + payload.result.failed + payload.result.manualReview;
      const pendingMessage = payload.result.newsPending
        ? ` ${payload.result.newsPending} ${payload.result.newsPending === 1 ? "matéria ficou pendente" : "matérias ficaram pendentes"} de texto ou imagem; tente sincronizar novamente em alguns minutos.`
        : "";
      const indicationMessage = indicationPending ? ` ${indicationPending} indicações aguardam enriquecimento ou revisão no painel.` : "";
      setError(payload.result.newsPending > 0 || indicationPending > 0);
      setMessage(`${successMessage}${pendingMessage}${indicationMessage}`);
      router.refresh();
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : "Falha na sincronização.");
    } finally {
      setLoading(null);
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
        <button className="admin-button admin-button--secondary" type="button" onClick={() => synchronize("indications")} disabled={Boolean(loading)}>
          <ArchiveRestore size={18} className={loading === "indications" ? "spin" : undefined} />
          {loading === "indications" ? "Recuperando indicações..." : "Restaurar histórico de indicações"}
        </button>
      </div>
      {message && <p className={error ? "camara-sync-message is-error" : "camara-sync-message"}>{message}</p>}
    </div>
  );
}
