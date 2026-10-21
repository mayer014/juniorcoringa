"use client";

import { History, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CamaraSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState<"daily" | "history" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function synchronize(mode: "daily" | "history") {
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
        result?: { inserted: number; updated: number; newsInserted: number; retitled: number };
      };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Não foi possível sincronizar.");
      setMessage(mode === "history"
        ? `${payload.result.inserted} leis históricas novas, ${payload.result.updated} atualizadas e ${payload.result.retitled} títulos simplificados.`
        : `${payload.result.inserted} novos registros, ${payload.result.updated} atualizados, ${payload.result.retitled} títulos simplificados e ${payload.result.newsInserted} novas matérias.`);
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
      </div>
      {message && <p className={error ? "camara-sync-message is-error" : "camara-sync-message"}>{message}</p>}
    </div>
  );
}
