export type PostStatus = "draft" | "published";

export type PostCategory = "Notícia" | "Projeto" | "Agenda" | "Inclusão";

export type Post = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: PostCategory;
  status: PostStatus;
  coverImage: string | null;
  featured: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  readingMinutes?: number;
};

export type PostInput = {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  category: PostCategory;
  status: PostStatus;
  coverImage?: string | null;
  featured?: boolean;
};

export type GalleryStatus = "published" | "hidden";

export type GalleryItem = {
  id: number;
  imageUrl: string;
  title: string;
  caption: string;
  postId: number | null;
  postTitle: string | null;
  postSlug: string | null;
  status: GalleryStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GalleryItemInput = {
  imageUrl: string;
  title?: string;
  caption?: string;
  postId?: number | null;
  status?: GalleryStatus;
};

export type PostOption = {
  id: number;
  title: string;
  slug: string;
};
