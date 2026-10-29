"use client";

import { ExternalLink, Eye, EyeOff, LoaderCircle, Pencil, Save, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { formatDate } from "@/lib/format";
import type { LegislativeItem } from "@/lib/types";

export function LegislativeManager({ initialItems }: { initialItems: LegislativeItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [review, setReview] = useState({ title: "", publicSummary: "", service: "", location: "", neighborhood: "", reference: "", enrichmentStatus: "complete" as "complete" | "manual_review" });

  function startReview(item: LegislativeItem) {
    setEditingId(item.id);
    setReview({
      title: item.title,
      publicSummary: item.publicSummary,
      service: item.service ?? "",
      location: item.location ?? "",
      neighborhood: item.neighborhood ?? "",
      reference: item.reference ?? "",
      enrichmentStatus: item.enrichmentStatus === "complete" ? "complete" : "manual_review",
    });
    setError("");
  }

  async function saveReview(item: LegislativeItem) {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/camara/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(review),
      });
      const payload = await response.json() as { item?: LegislativeItem; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "Não foi possível salvar a revisão.");
      setItems((current) => current.map((entry) => entry.id === item.id ? payload.item as LegislativeItem : entry));
      setEditingId(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a revisão.");
    } finally {
      setBusyId(null);
    }
  }

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

  async function setFeatured(item: LegislativeItem) {
    setBusyId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/admin/camara/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured: !item.featured }),
      });
      const payload = await response.json() as { item?: LegislativeItem; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "Não foi possível alterar o destaque.");
      setItems((current) => current.map((entry) => entry.id === item.id ? payload.item as LegislativeItem : entry));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar o destaque.");
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
            const incomplete = ["pending", "failed", "manual_review"].includes(item.enrichmentStatus);
            const qualityLabel = item.enrichmentStatus === "complete" ? "Completo" : item.enrichmentStatus === "failed" ? "Falha no PDF" : item.enrichmentStatus === "manual_review" ? "Revisar" : item.enrichmentStatus === "pending" ? "Aguardando PDF" : "Não aplicável";
            return <Fragment key={item.id}><tr className={item.published ? undefined : "is-hidden"}>
              <td><strong>{item.title}</strong><small>{item.type} nº {item.number}/{item.year}{item.neighborhood ? ` · ${item.neighborhood}` : ""}</small></td>
              <td><span className="category-chip">{item.kind === "indication" ? "Indicação" : item.lawNumber || "Projeto"}</span>{item.featured && <small className="quality-chip quality-chip--featured"><Star size={10} fill="currentColor" /> Destaque</small>}{item.kind === "indication" && <small className={`quality-chip quality-chip--${item.enrichmentStatus}`}>{qualityLabel}</small>}</td>
              <td>{item.year}</td>
              <td><span className={`status-chip status-chip--${item.published ? "published" : "draft"}`}>{item.published ? <Eye size={12} /> : <EyeOff size={12} />}{item.published ? "Visível" : "Oculto"}</span></td>
              <td>{formatDate(item.updatedAt, "short")}</td>
              <td><div className="row-actions">
                {item.kind === "project" && <button className={`icon-action${item.featured ? " icon-action--featured" : ""}`} type="button" onClick={() => setFeatured(item)} disabled={busy} aria-label={item.featured ? "Remover dos destaques" : "Destacar projeto"} title={item.featured ? "Remover dos destaques" : "Destacar projeto no site"}><Star size={16} fill={item.featured ? "currentColor" : "none"} /></button>}
                {item.published && <Link className="icon-action" href={`/atuacao-legislativa/${item.id}`} target="_blank" aria-label="Ver no site" title="Ver no site"><ExternalLink size={16} /></Link>}
                {item.kind === "indication" && <button className="icon-action" type="button" onClick={() => startReview(item)} disabled={busy} aria-label="Revisar dados" title="Revisar título e localização"><Pencil size={16} /></button>}
                <button className="icon-action" type="button" onClick={() => setVisibility(item)} disabled={busy || (!item.published && incomplete)} aria-label={item.published ? "Ocultar" : "Exibir"} title={!item.published && incomplete ? "Revise os dados antes de publicar" : item.published ? "Ocultar do site" : "Exibir no site"}>{busy ? <LoaderCircle className="spin" size={16} /> : item.published ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                <button className="icon-action icon-action--danger" type="button" onClick={() => remove(item)} disabled={busy} aria-label="Excluir" title="Excluir permanentemente"><Trash2 size={16} /></button>
              </div></td>
            </tr>{editingId === item.id && <tr className="legislative-review-row"><td colSpan={6}><div className="legislative-review-form">
              <div className="legislative-review-heading"><div><strong>Revisar dados públicos</strong><small>As alterações manuais não serão sobrescritas pela próxima sincronização.</small></div><button type="button" className="icon-action" onClick={() => setEditingId(null)} aria-label="Fechar"><X size={16} /></button></div>
              <label className="admin-field legislative-review-wide"><span>Título público</span><input value={review.title} onChange={(event) => setReview((current) => ({ ...current, title: event.target.value }))} maxLength={180} /></label>
              <label className="admin-field legislative-review-wide"><span>Descrição pública</span><textarea value={review.publicSummary} onChange={(event) => setReview((current) => ({ ...current, publicSummary: event.target.value }))} rows={3} maxLength={500} /></label>
              <label className="admin-field legislative-review-wide"><span>Serviço solicitado</span><textarea value={review.service} onChange={(event) => setReview((current) => ({ ...current, service: event.target.value }))} rows={2} maxLength={500} /></label>
              <label className="admin-field"><span>Endereço</span><input value={review.location} onChange={(event) => setReview((current) => ({ ...current, location: event.target.value }))} maxLength={500} /></label>
              <label className="admin-field"><span>Bairro</span><input value={review.neighborhood} onChange={(event) => setReview((current) => ({ ...current, neighborhood: event.target.value }))} maxLength={180} /></label>
              <label className="admin-field"><span>Ponto de referência</span><input value={review.reference} onChange={(event) => setReview((current) => ({ ...current, reference: event.target.value }))} maxLength={300} /></label>
              <label className="admin-field"><span>Conferência</span><select value={review.enrichmentStatus} onChange={(event) => setReview((current) => ({ ...current, enrichmentStatus: event.target.value as "complete" | "manual_review" }))}><option value="complete">Dados conferidos</option><option value="manual_review">Manter em revisão</option></select></label>
              <div className="legislative-review-actions"><button type="button" className="admin-button admin-button--primary" onClick={() => saveReview(item)} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Salvar revisão</button></div>
            </div></td></tr>}</Fragment>;
          })}</tbody>
        </table>
      </div>
    </>
  );
}
