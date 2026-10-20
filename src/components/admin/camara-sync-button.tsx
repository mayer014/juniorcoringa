"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CamaraSyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function synchronize() {
    setLoading(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/admin/camara/sync", { method: "POST" });
      const payload = await response.json() as {
        error?: string;
        result?: { inserted: number; updated: number; newsInserted: number };
      };
      if (!response.ok || !payload.result) throw new Error(payload.error || "Não foi possível sincronizar.");
      setMessage(`${payload.result.inserted} novos registros, ${payload.result.updated} atualizados e ${payload.result.newsInserted} novas matérias.`);
      router.refresh();
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : "Falha na sincronização.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="camara-sync-action">
      <button className="admin-button admin-button--primary" type="button" onClick={synchronize} disabled={loading}>
        <RefreshCw size={18} className={loading ? "spin" : undefined} />
        {loading ? "Sincronizando..." : "Sincronizar agora"}
      </button>
      {message && <p className={error ? "camara-sync-message is-error" : "camara-sync-message"}>{message}</p>}
    </div>
  );
}
