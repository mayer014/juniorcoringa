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

export type LegislativeKind = "project" | "indication";
export type LegislativeStatusGroup = "processing" | "approved" | "archived" | "protocolled";

export type LegislativeItem = {
  id: number;
  externalId: string;
  kind: LegislativeKind;
  type: string;
  number: string;
  year: number;
  title: string;
  summary: string;
  author: string;
  status: string;
  statusGroup: LegislativeStatusGroup;
  sourceUrl: string;
  location: string | null;
  neighborhood: string | null;
  service: string | null;
  fullText: string | null;
  lawNumber: string | null;
  lawDate: string | null;
  lawUrl: string | null;
  authorRole: string | null;
  occurredAt: string;
  firstSeenAt: string;
  lastSeenAt: string;
  updatedAt: string;
};

export type LegislativeItemInput = Omit<LegislativeItem, "id" | "firstSeenAt" | "lastSeenAt" | "updatedAt"> & {
  rawJson?: string;
};

export type CamaraSyncRun = {
  id: number;
  startedAt: string;
  finishedAt: string | null;
  status: "running" | "success" | "error";
  found: number;
  inserted: number;
  updated: number;
  newsInserted: number;
  error: string | null;
};
