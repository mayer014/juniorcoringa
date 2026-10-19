"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PostCard } from "@/components/post-card";
import type { Post, PostCategory } from "@/lib/types";

const categories: Array<"Todos" | PostCategory> = ["Todos", "Notícia", "Projeto", "Agenda", "Inclusão"];

export function PostsExplorer({ posts }: { posts: Post[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("Todos");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return posts.filter((post) => {
      const matchesCategory = category === "Todos" || post.category === category;
      const matchesQuery =
        !normalized ||
        `${post.title} ${post.excerpt}`.toLocaleLowerCase("pt-BR").includes(normalized);
      return matchesCategory && matchesQuery;
    });
  }, [posts, query, category]);

  return (
    <>
      <div className="post-filters">
        <label className="search-field">
          <Search size={19} />
          <span className="sr-only">Buscar publicações</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar uma matéria..."
          />
        </label>
        <div className="filter-pills" aria-label="Filtrar por categoria">
          {categories.map((item) => (
            <button
              type="button"
              key={item}
              className={item === category ? "is-active" : undefined}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {filtered.length ? (
        <div className="posts-grid">
          {filtered.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      ) : (
        <div className="empty-state">
          <strong>Nenhuma publicação encontrada.</strong>
          <span>Tente outro termo ou uma categoria diferente.</span>
        </div>
      )}
    </>
  );
}
