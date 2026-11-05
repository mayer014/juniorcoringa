import type { Metadata } from "next";
import path from "node:path";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock3 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatDate, readingTime } from "@/lib/format";
import { getPublishedPost } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

async function coverDimensions(src: string) {
  const fallback = { width: 1600, height: 1000 };
  const filename = path.basename(src);
  if (src !== `/media/${filename}`) return fallback;
  const dataDir = path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"));
  try {
    const { default: sharp } = await import("sharp");
    const metadata = await sharp(path.join(dataDir, "uploads", filename)).metadata();
    const { width, height } = metadata.autoOrient;
    return width && height ? { width, height } : fallback;
  } catch {
    return fallback;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPublishedPost(slug);
  if (!post) return { title: "Publicação não encontrada" };
  return {
    title: post.title,
    description: post.excerpt,
    openGraph: post.coverImage ? { images: [post.coverImage] } : undefined,
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPublishedPost(slug);
  if (!post) notFound();

  const dimensions = post.coverImage ? await coverDimensions(post.coverImage) : null;

  return (
    <>
      <SiteHeader />
      <main className="article-page">
        <header className="article-header">
          <div className="shell shell--article">
            <Link href="/noticias" className="back-link"><ArrowLeft size={17} /> Voltar para notícias</Link>
            <span className="article-category">{post.category}</span>
            <h1>{post.title}</h1>
            <p className="article-lead">{post.excerpt}</p>
            <div className="article-meta">
              <span>{formatDate(post.publishedAt)}</span>
              <i />
              <span><Clock3 size={16} /> {readingTime(post.content)} min de leitura</span>
            </div>
          </div>
        </header>

        {post.coverImage && dimensions && (
          <div className="shell article-cover">
            <Image src={post.coverImage} alt="" width={dimensions.width} height={dimensions.height} priority sizes="(max-width: 1100px) 94vw, 1100px" />
          </div>
        )}

        <article className="shell shell--article article-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </article>

        <div className="shell shell--article article-back">
          <Link href="/noticias" className="button button--outline"><ArrowLeft size={18} /> Ver outras publicações</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
