"use client";

import { ExternalLink, Eye, EyeOff, LoaderCircle, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/format";
import type { LegislativeItem } from "@/lib/types";

export function LegislativeManager({ initialItems }: { initialItems: LegislativeItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function setVisibility(item: LegislativeItem) {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/camara/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: !item.published }),
      });
      const payload = await response.json() as { item?: LegislativeItem; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "Não foi possível alterar a exibição.");
      setItems((current) => current.map((entry) => entry.id === item.id ? payload.item as LegislativeItem : entry));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar a exibição.");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: LegislativeItem) {
    if (!window.confirm(`Excluir permanentemente “${item.title}”?\n\nO registro não voltará nas próximas sincronizações.`)) return;
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/camara/items/${item.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível excluir o registro.");
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível excluir o registro.");
    } finally {
      setBusyId(null);
    }
  }

  if (!items.length) return <div className="admin-empty"><h3>Nenhum registro encontrado</h3><p>Altere os filtros ou faça uma sincronização.</p></div>;

  return (
    <>
      {error && <div className="admin-alert" role="alert">{error}</div>}
      <div className="admin-table-wrap">
        <table className="admin-table legislative-admin-table">
          <thead><tr><th>Registro</th><th>Tipo</th><th>Ano</th><th>Exibição</th><th>Atualizado</th><th>Ações</th></tr></thead>
          <tbody>{items.map((item) => {
            const busy = busyId === item.id;
            return <tr key={item.id} className={item.published ? undefined : "is-hidden"}>
              <td><strong>{item.title}</strong><small>{item.type} nº {item.number}/{item.year}{item.neighborhood ? ` · ${item.neighborhood}` : ""}</small></td>
              <td><span className="category-chip">{item.kind === "indication" ? "Indicação" : item.lawNumber || "Projeto"}</span></td>
              <td>{item.year}</td>
              <td><span className={`status-chip status-chip--${item.published ? "published" : "draft"}`}>{item.published ? <Eye size={12} /> : <EyeOff size={12} />}{item.published ? "Visível" : "Oculto"}</span></td>
              <td>{formatDate(item.updatedAt, "short")}</td>
              <td><div className="row-actions">
                {item.published && <Link className="icon-action" href={`/atuacao-legislativa/${item.id}`} target="_blank" aria-label="Ver no site" title="Ver no site"><ExternalLink size={16} /></Link>}
                <button className="icon-action" type="button" onClick={() => setVisibility(item)} disabled={busy} aria-label={item.published ? "Ocultar" : "Exibir"} title={item.published ? "Ocultar do site" : "Exibir no site"}>{busy ? <LoaderCircle className="spin" size={16} /> : item.published ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                <button className="icon-action icon-action--danger" type="button" onClick={() => remove(item)} disabled={busy} aria-label="Excluir" title="Excluir permanentemente"><Trash2 size={16} /></button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </>
  );
}
