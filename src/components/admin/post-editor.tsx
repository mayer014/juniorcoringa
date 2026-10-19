"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bold, Eye, Heading2, ImagePlus, Italic, Link2, List, Save, Send, X } from "lucide-react";
import type { Post, PostCategory, PostStatus } from "@/lib/types";

const categories: PostCategory[] = ["Notícia", "Projeto", "Agenda", "Inclusão"];

export function PostEditor({ post }: { post?: Post }) {
  const router = useRouter();
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(post?.title || "");
  const [slug, setSlug] = useState(post?.slug || "");
  const [excerpt, setExcerpt] = useState(post?.excerpt || "");
  const [content, setContent] = useState(post?.content || "");
  const [category, setCategory] = useState<PostCategory>(post?.category || "Notícia");
  const [status, setStatus] = useState<PostStatus>(post?.status || "draft");
  const [featured, setFeatured] = useState(post?.featured || false);
  const [coverImage, setCoverImage] = useState(post?.coverImage || "");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [localPreview, setLocalPreview] = useState("");

  useEffect(() => {
    if (!coverFile) {
      setLocalPreview("");
      return;
    }
    const url = URL.createObjectURL(coverFile);
    setLocalPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  function insertMarkdown(before: string, after = "", placeholder = "texto") {
    const textarea = contentRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end) || placeholder;
    const next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`;
    setContent(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  async function uploadCover() {
    if (!coverFile) return coverImage || null;
    const formData = new FormData();
    formData.append("file", coverFile);
    const response = await fetch("/api/admin/media", { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Falha ao enviar a imagem.");
    return result.url as string;
  }

  async function save(nextStatus: PostStatus) {
    setSaving(true);
    setError("");
    try {
      const uploadedCover = await uploadCover();
      const response = await fetch(post ? `/api/admin/posts/${post.id}` : "/api/admin/posts", {
        method: post ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, slug, excerpt, content, category, status: nextStatus, featured, coverImage: uploadedCover }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      router.push("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const previewUrl = localPreview || coverImage;

  return (
    <div className="editor-page">
      <div className="admin-page-header admin-page-header--editor">
        <button className="back-button" type="button" onClick={() => router.push("/admin")}><ArrowLeft size={18} /> Voltar</button>
        <div className="editor-actions">
          <button className="admin-button admin-button--secondary" type="button" disabled={saving} onClick={() => save("draft")}><Save size={17} /> Salvar rascunho</button>
          <button className="admin-button admin-button--primary" type="button" disabled={saving} onClick={() => save("published")}><Send size={17} /> {status === "published" ? "Atualizar" : "Publicar"}</button>
        </div>
      </div>

      {error && <div className="admin-alert" role="alert">{error}</div>}

      <div className="editor-grid">
        <section className="editor-main-card">
          <label className="admin-field admin-field--title">
            <span>Título da matéria</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Digite um título claro e objetivo" maxLength={160} />
          </label>
          <label className="admin-field">
            <span>Resumo</span>
            <textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} placeholder="Uma breve descrição que aparecerá nos cards da página" rows={3} maxLength={320} />
            <small>{excerpt.length}/320 caracteres</small>
          </label>
          <div className="admin-field">
            <span>Conteúdo</span>
            <div className="editor-toolbar" aria-label="Formatação">
              <button type="button" title="Título" onClick={() => insertMarkdown("## ", "", "Título da seção")}><Heading2 size={17} /></button>
              <button type="button" title="Negrito" onClick={() => insertMarkdown("**", "**")}><Bold size={17} /></button>
              <button type="button" title="Itálico" onClick={() => insertMarkdown("_", "_")}><Italic size={17} /></button>
              <button type="button" title="Lista" onClick={() => insertMarkdown("- ", "", "Item da lista")}><List size={17} /></button>
              <button type="button" title="Link" onClick={() => insertMarkdown("[", "](https://)", "texto do link")}><Link2 size={17} /></button>
            </div>
            <textarea ref={contentRef} className="content-editor" value={content} onChange={(event) => setContent(event.target.value)} placeholder="Escreva a matéria aqui..." rows={20} />
            <small>Use a barra acima para formatar títulos, destaques, listas e links.</small>
          </div>
        </section>

        <aside className="editor-sidebar">
          <section className="editor-panel">
            <h2>Publicação</h2>
            <label className="admin-field">
              <span>Categoria</span>
              <select value={category} onChange={(event) => setCategory(event.target.value as PostCategory)}>
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="admin-field">
              <span>Endereço amigável</span>
              <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="gerado-automaticamente" />
            </label>
            <label className="admin-check">
              <input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} />
              <span><strong>Destacar na página inicial</strong><small>Esta matéria terá prioridade no feed.</small></span>
            </label>
            {post && <div className={`status-chip status-chip--${status}`}><Eye size={14} /> {status === "published" ? "Publicada" : "Rascunho"}</div>}
          </section>

          <section className="editor-panel">
            <h2>Imagem de capa</h2>
            {previewUrl ? (
              <div className="cover-preview">
                <Image src={previewUrl} alt="Prévia da capa" fill unoptimized={Boolean(coverFile)} />
                <button type="button" onClick={() => { setCoverFile(null); setCoverImage(""); }} aria-label="Remover imagem"><X size={16} /></button>
              </div>
            ) : (
              <label className="cover-upload">
                <ImagePlus size={26} />
                <strong>Escolher imagem</strong>
                <span>JPG, PNG ou WebP · até 8 MB</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] || null)} />
              </label>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
