import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { formatDate, readingTime } from "@/lib/format";
import type { Post } from "@/lib/types";

export function PostCard({ post, featured = false }: { post: Post; featured?: boolean }) {
  return (
    <article className={`post-card${featured ? " post-card--featured" : ""}`}>
      <Link href={`/noticias/${post.slug}`} className="post-card__image" tabIndex={-1}>
        {post.coverImage ? (
          <Image src={post.coverImage} alt="" fill sizes={featured ? "(max-width: 900px) 100vw, 58vw" : "(max-width: 700px) 100vw, 33vw"} />
        ) : (
          <div className="post-card__placeholder" aria-hidden="true">
            <span>JC</span>
          </div>
        )}
        <span className="post-card__category">{post.category}</span>
      </Link>
      <div className="post-card__body">
        <div className="post-card__meta">
          <span>{formatDate(post.publishedAt, "short")}</span>
          <span><Clock3 size={14} /> {post.readingMinutes ?? readingTime(post.content)} min</span>
        </div>
        <h3><Link href={`/noticias/${post.slug}`}>{post.title}</Link></h3>
        <p>{post.excerpt}</p>
        <Link href={`/noticias/${post.slug}`} className="text-link">
          Ler matéria <ArrowUpRight size={17} />
        </Link>
      </div>
    </article>
  );
}
