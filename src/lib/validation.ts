import type { PostCategory, PostInput, PostStatus } from "@/lib/types";

const categories: PostCategory[] = ["Notícia", "Projeto", "Agenda", "Inclusão"];
const statuses: PostStatus[] = ["draft", "published"];

export function validatePostInput(value: unknown): { data?: PostInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inválidos." };
  const body = value as Record<string, unknown>;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const excerpt = typeof body.excerpt === "string" ? body.excerpt.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : undefined;
  const coverImage = typeof body.coverImage === "string" ? body.coverImage.trim() : null;
  const category = body.category as PostCategory;
  const status = body.status as PostStatus;

  if (title.length < 5 || title.length > 160) return { error: "O título deve ter entre 5 e 160 caracteres." };
  if (excerpt.length < 10 || excerpt.length > 320) return { error: "O resumo deve ter entre 10 e 320 caracteres." };
  if (content.length < 20 || content.length > 100_000) return { error: "O conteúdo precisa ter pelo menos 20 caracteres." };
  if (!categories.includes(category)) return { error: "Categoria inválida." };
  if (!statuses.includes(status)) return { error: "Status inválido." };
  if (coverImage && !coverImage.startsWith("/media/")) return { error: "Imagem de capa inválida." };

  return {
    data: {
      title,
      excerpt,
      content,
      slug,
      coverImage,
      category,
      status,
      featured: Boolean(body.featured),
    },
  };
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expectedHost =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      new URL(request.url).host;
    return new URL(origin).host === expectedHost;
  } catch {
    return false;
  }
}
