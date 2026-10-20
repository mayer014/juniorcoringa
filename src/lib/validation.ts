import type { GalleryItemInput, GalleryStatus, PostCategory, PostInput, PostStatus } from "@/lib/types";

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

export function validateGalleryItemInput(value: unknown): { data?: GalleryItemInput; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inválidos." };
  const body = value as Record<string, unknown>;
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const caption = typeof body.caption === "string" ? body.caption.trim() : "";
  const status = body.status === "hidden" ? "hidden" : "published" as GalleryStatus;
  const postId = body.postId === null || body.postId === "" || body.postId === undefined
    ? null
    : Number(body.postId);

  if (!imageUrl.startsWith("/media/")) return { error: "Imagem inválida." };
  if (title.length > 180) return { error: "O título deve ter no máximo 180 caracteres." };
  if (caption.length > 600) return { error: "A legenda deve ter no máximo 600 caracteres." };
  if (postId !== null && (!Number.isInteger(postId) || postId < 1)) return { error: "Matéria vinculada inválida." };

  return { data: { imageUrl, title, caption, postId, status } };
}

export function validateGalleryItems(value: unknown): { data?: GalleryItemInput[]; error?: string } {
  if (!value || typeof value !== "object") return { error: "Dados inválidos." };
  const items = (value as Record<string, unknown>).items;
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    return { error: "Envie entre 1 e 30 imagens por vez." };
  }

  const parsed: GalleryItemInput[] = [];
  for (const item of items) {
    const result = validateGalleryItemInput(item);
    if (!result.data) return { error: result.error };
    parsed.push(result.data);
  }
  return { data: parsed };
}
