"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Check, Eye, EyeOff, ImagePlus, Images, LoaderCircle, Save, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GalleryItem, GalleryStatus, PostOption } from "@/lib/types";

export function GalleryManager({ initialItems, postOptions }: { initialItems: GalleryItem[]; postOptions: PostOption[] }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState(initialItems);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [postId, setPostId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function selectFiles(nextFiles: FileList | null) {
    setError("");
    if (!nextFiles) return;
    const accepted = Array.from(nextFiles).filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    if (accepted.length > 30) {
      setError("Selecione no máximo 30 imagens por envio.");
      return;
    }
    if (accepted.some((file) => file.size > 8 * 1024 * 1024)) {
      setError("Cada imagem deve ter no máximo 8 MB.");
      return;
    }
    setFiles(accepted);
  }

  async function upload() {
    if (!files.length) return;
    setUploading(true);
    setProgress(0);
    setError("");
    setMessage("");
    try {
      const uploaded = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const formData = new FormData();
        formData.append("file", file);
        const response = await fetch("/api/admin/media", { method: "POST", body: formData });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || `Não foi possível enviar ${file.name}.`);
        uploaded.push({
          imageUrl: result.url as string,
          title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim(),
          caption: "",
          postId: postId ? Number(postId) : null,
          status: "published" as GalleryStatus,
        });
        setProgress(index + 1);
      }

      const response = await fetch("/api/admin/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: uploaded }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível cadastrar as fotos.");
      setItems((current) => [...current, ...result.items]);
      setFiles([]);
      setPostId("");
      if (inputRef.current) inputRef.current.value = "";
      setMessage(`${result.items.length} ${result.items.length === 1 ? "foto adicionada" : "fotos adicionadas"} com sucesso.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar as fotos.");
    } finally {
      setUploading(false);
    }
  }

  async function reorder(index: number, direction: number) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const previous = items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setError("");
    try {
      const response = await fetch("/api/admin/gallery/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: next.map((item) => item.id) }),
      });
      if (!response.ok) throw new Error("Não foi possível alterar a ordem.");
    } catch (caught) {
      setItems(previous);
      setError(caught instanceof Error ? caught.message : "Não foi possível alterar a ordem.");
    }
  }

  return (
    <div className="admin-content gallery-admin">
      <div className="admin-page-header">
        <div><span>Conteúdo visual</span><h1>Galeria de fotos</h1><p>Envie, organize e publique os registros do mandato.</p></div>
        <span className="gallery-admin__count"><Images size={18} /> {items.length} {items.length === 1 ? "foto" : "fotos"}</span>
      </div>

      {error && <div className="admin-alert" role="alert">{error}</div>}
      {message && <div className="admin-alert admin-alert--success" role="status"><Check size={17} /> {message}</div>}

      <section className="gallery-upload-card">
        <div className="gallery-upload-card__intro">
          <span><ImagePlus size={23} /></span>
          <div><h2>Adicionar novas fotos</h2><p>JPG, PNG ou WebP · até 8 MB por imagem · máximo de 30 por envio.</p></div>
        </div>
        <label className={`gallery-dropzone${files.length ? " has-files" : ""}`}>
          <Upload size={29} />
          <strong>{files.length ? `${files.length} ${files.length === 1 ? "imagem selecionada" : "imagens selecionadas"}` : "Escolher imagens"}</strong>
          <span>Você pode selecionar várias fotos de uma vez</span>
          <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => selectFiles(event.target.files)} disabled={uploading} />
        </label>
        {previews.length > 0 && <div className="gallery-upload-preview">{previews.slice(0, 12).map((src, index) => <div key={src}><Image src={src} alt={`Prévia ${index + 1}`} fill unoptimized /></div>)}{previews.length > 12 && <span>+{previews.length - 12}</span>}</div>}
        <div className="gallery-upload-actions">
          <label className="admin-field"><span>Vincular todas a uma matéria (opcional)</span><select value={postId} onChange={(event) => setPostId(event.target.value)} disabled={uploading}><option value="">Nenhuma matéria</option>{postOptions.map((post) => <option key={post.id} value={post.id}>{post.title}</option>)}</select></label>
          {files.length > 0 && <button className="admin-button admin-button--secondary" type="button" onClick={() => setFiles([])} disabled={uploading}><X size={17} /> Limpar</button>}
          <button className="admin-button admin-button--primary" type="button" onClick={upload} disabled={!files.length || uploading}>{uploading ? <><LoaderCircle className="spin" size={17} /> Enviando {progress}/{files.length}</> : <><Upload size={17} /> Publicar fotos</>}</button>
        </div>
      </section>

      <section className="gallery-admin-list">
        <div className="admin-list-card__heading"><h2>Fotos cadastradas</h2><span>As 16 primeiras aparecem no mural</span></div>
        {items.length ? <div className="gallery-admin-grid">{items.map((item, index) => <GalleryAdminCard key={item.id} item={item} postOptions={postOptions} index={index} total={items.length} onMove={reorder} onUpdate={(updated) => setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry))} onRemove={(id) => setItems((current) => current.filter((entry) => entry.id !== id))} />)}</div> : <div className="admin-empty"><span><Images size={28} /></span><h3>Nenhuma foto cadastrada</h3><p>Use o formulário acima para criar a galeria do mandato.</p></div>}
      </section>
    </div>
  );
}

function GalleryAdminCard({ item, postOptions, index, total, onMove, onUpdate, onRemove }: { item: GalleryItem; postOptions: PostOption[]; index: number; total: number; onMove: (index: number, direction: number) => Promise<void>; onUpdate: (item: GalleryItem) => void; onRemove: (id: number) => void; }) {
  const [title, setTitle] = useState(item.title);
  const [caption, setCaption] = useState(item.caption);
  const [postId, setPostId] = useState(item.postId ? String(item.postId) : "");
  const [status, setStatus] = useState<GalleryStatus>(item.status);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true); setSaved(false); setError("");
    try {
      const response = await fetch(`/api/admin/gallery/${item.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageUrl: item.imageUrl, title, caption, postId: postId ? Number(postId) : null, status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      onUpdate(result.item); setSaved(true); window.setTimeout(() => setSaved(false), 1800);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!window.confirm("Remover esta foto da galeria? O arquivo original será preservado.")) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/gallery/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Não foi possível remover a foto.");
      onRemove(item.id);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível remover a foto."); setSaving(false); }
  }

  return (
    <article className="gallery-admin-card">
      <div className="gallery-admin-card__image">
        <Image src={item.imageUrl} alt={title || "Foto da galeria"} fill sizes="(max-width: 850px) 90vw, 32vw" />
        <span className={`status-chip status-chip--${status === "published" ? "published" : "draft"}`}>{status === "published" ? <Eye size={12} /> : <EyeOff size={12} />}{status === "published" ? "Visível" : "Oculta"}</span>
        <div className="gallery-order"><button type="button" onClick={() => onMove(index, -1)} disabled={index === 0 || saving} aria-label="Mover foto para cima"><ArrowUp size={16} /></button><b>{index + 1}</b><button type="button" onClick={() => onMove(index, 1)} disabled={index === total - 1 || saving} aria-label="Mover foto para baixo"><ArrowDown size={16} /></button></div>
      </div>
      <div className="gallery-admin-card__fields">
        <label className="admin-field"><span>Título</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={180} placeholder="Título da foto" /></label>
        <label className="admin-field"><span>Legenda</span><textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={2} maxLength={600} placeholder="Contexto ou descrição opcional" /></label>
        <div className="gallery-admin-card__row"><label className="admin-field"><span>Matéria relacionada</span><select value={postId} onChange={(event) => setPostId(event.target.value)}><option value="">Nenhuma</option>{postOptions.map((post) => <option key={post.id} value={post.id}>{post.title}</option>)}</select></label><label className="admin-field"><span>Exibição</span><select value={status} onChange={(event) => setStatus(event.target.value as GalleryStatus)}><option value="published">Visível</option><option value="hidden">Oculta</option></select></label></div>
        {error && <small className="gallery-card-error">{error}</small>}
        <div className="gallery-admin-card__actions"><button className="gallery-delete" type="button" onClick={remove} disabled={saving}><Trash2 size={16} /> Remover</button><button className="admin-button admin-button--primary" type="button" onClick={save} disabled={saving}>{saved ? <><Check size={16} /> Salvo</> : <><Save size={16} /> Salvar</>}</button></div>
      </div>
    </article>
  );
}
