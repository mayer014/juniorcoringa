import Link from "next/link";
import { Edit3, Eye, FilePlus2, FileText, Newspaper, PencilLine } from "lucide-react";
import { DeletePostButton } from "@/components/admin/delete-post-button";
import { formatDate } from "@/lib/format";
import { getPostCounts, listAllPosts } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function AdminDashboard() {
  const posts = listAllPosts();
  const counts = getPostCounts();

  return (
    <div className="admin-content">
      <div className="admin-page-header">
        <div><span>Conteúdo do site</span><h1>Publicações</h1><p>Gerencie notícias, projetos e agendas em um só lugar.</p></div>
        <Link href="/admin/nova" className="admin-button admin-button--primary"><FilePlus2 size={18} /> Nova matéria</Link>
      </div>

      <div className="admin-stats">
        <article><span><FileText size={20} /></span><div><strong>{counts.total}</strong><small>Total</small></div></article>
        <article><span><Newspaper size={20} /></span><div><strong>{counts.published}</strong><small>Publicadas</small></div></article>
        <article><span><PencilLine size={20} /></span><div><strong>{counts.drafts}</strong><small>Rascunhos</small></div></article>
      </div>

      <section className="admin-list-card">
        <div className="admin-list-card__heading"><h2>Todas as matérias</h2><span>{posts.length} {posts.length === 1 ? "item" : "itens"}</span></div>
        {posts.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Publicação</th><th>Categoria</th><th>Status</th><th>Atualizada</th><th><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id}>
                    <td><strong>{post.title}</strong><small>{post.excerpt}</small></td>
                    <td><span className="category-chip">{post.category}</span></td>
                    <td><span className={`status-chip status-chip--${post.status}`}>{post.status === "published" ? "Publicada" : "Rascunho"}</span></td>
                    <td>{formatDate(post.updatedAt, "short")}</td>
                    <td><div className="row-actions">
                      {post.status === "published" && <Link className="icon-action" href={`/noticias/${post.slug}`} target="_blank" aria-label={`Ver ${post.title}`}><Eye size={17} /></Link>}
                      <Link className="icon-action" href={`/admin/editar/${post.id}`} aria-label={`Editar ${post.title}`}><Edit3 size={17} /></Link>
                      <DeletePostButton id={post.id} title={post.title} />
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="admin-empty"><span><FileText size={28} /></span><h3>Nenhuma matéria ainda</h3><p>Crie a primeira publicação do mandato.</p><Link href="/admin/nova" className="admin-button admin-button--primary"><FilePlus2 size={17} /> Criar matéria</Link></div>
        )}
      </section>
    </div>
  );
}
