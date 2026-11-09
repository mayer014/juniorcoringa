"use client";

import { Cable, Loader2, RefreshCw, Webhook } from "lucide-react";
import { useState } from "react";

type State = "open" | "close" | "connecting" | "unknown";

export function EvolutionManager({ initialState, configured }: { initialState: State; configured: boolean }) {
  const [state, setState] = useState(initialState);
  const [loading, setLoading] = useState<"status" | "webhook" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function request(action: "status" | "webhook") {
    setLoading(action); setMessage(""); setError(false);
    try {
      const response = await fetch(action === "status" ? "/api/admin/evolution/status" : "/api/admin/evolution/webhook", { method: action === "status" ? "GET" : "POST" });
      const responseText = await response.text();
      let payload: { state?: State; error?: string; message?: string } = {};
      try {
        payload = responseText ? JSON.parse(responseText) as typeof payload : {};
      } catch {
        throw new Error(`O servidor devolveu uma resposta inválida (HTTP ${response.status}). Consulte os logs da implantação.`);
      }
      if (!response.ok) throw new Error(payload.error || "Não foi possível concluir.");
      if (payload.state) setState(payload.state);
      setMessage(payload.message || (action === "webhook" ? "Webhook configurado na Evolution API." : "Situação atualizada."));
    } catch (caught) { setError(true); setMessage(caught instanceof Error ? caught.message : "Não foi possível concluir."); }
    finally { setLoading(null); }
  }

  const labels: Record<State, string> = { open: "Conectado", close: "Desconectado", connecting: "Conectando", unknown: "Não verificado" };
  return <div className="evolution-actions">
    <div className={`evolution-live evolution-live--${state}`}><span /><div><small>WhatsApp</small><strong>{labels[state]}</strong></div></div>
    <div className="evolution-actions__buttons">
      <button className="admin-button admin-button--secondary" disabled={!configured || Boolean(loading)} onClick={() => request("status")} type="button">{loading === "status" ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />} Testar conexão</button>
      <button className="admin-button admin-button--primary" disabled={!configured || Boolean(loading)} onClick={() => request("webhook")} type="button">{loading === "webhook" ? <Loader2 className="spin" size={17} /> : <Webhook size={17} />} Configurar retornos</button>
    </div>
    {message && <p className={error ? "is-error" : "is-success"}><Cable size={15} /> {message}</p>}
  </div>;
}
