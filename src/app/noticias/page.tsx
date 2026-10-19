import { PostsExplorer } from "@/components/posts-explorer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { listPublishedPostSummaries } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Notícias e projetos",
  description: "Acompanhe as notícias, projetos e ações do mandato do vereador Junior Coringa.",
};

export default function NewsPage() {
  const posts = listPublishedPostSummaries();

  return (
    <>
      <SiteHeader />
      <main>
        <section className="page-hero">
          <div className="shell">
            <div className="eyebrow"><span /> Mandato em movimento</div>
            <h1>Notícias e <em>projetos</em></h1>
            <p>Acompanhe as ações, propostas e agendas do vereador Junior Coringa em Campo Grande.</p>
          </div>
        </section>
        <section className="section archive">
          <div className="shell">
            {posts.length ? (
              <PostsExplorer posts={posts} />
            ) : (
              <div className="empty-state empty-state--large">
                <strong>As publicações aparecerão aqui.</strong>
                <span>O painel administrativo já está pronto para receber a primeira matéria.</span>
              </div>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
