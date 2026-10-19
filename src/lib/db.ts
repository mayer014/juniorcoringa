import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { GalleryItem, GalleryItemInput, GalleryStatus, Post, PostCategory, PostInput, PostOption, PostStatus } from "@/lib/types";

type PostRow = {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: PostCategory;
  status: PostStatus;
  cover_image: string | null;
  featured: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  reading_minutes?: number;
};

type GalleryRow = {
  id: number;
  image_url: string;
  title: string;
  caption: string;
  post_id: number | null;
  post_title: string | null;
  post_slug: string | null;
  status: GalleryStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

const globalForDb = globalThis as unknown as { juniorCoringaDb?: Database.Database };

function openDatabase() {
  const dataDir = path.resolve(
    /* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"),
  );
  fs.mkdirSync(dataDir, { recursive: true });

  const database = new Database(path.join(dataDir, "junior-coringa.sqlite"));
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      excerpt TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Notícia',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
      cover_image TEXT,
      featured INTEGER NOT NULL DEFAULT 0,
      published_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_posts_publication
      ON posts(status, published_at DESC);

    CREATE TABLE IF NOT EXISTS gallery_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_url TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('published', 'hidden')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_gallery_publication
      ON gallery_items(status, sort_order, created_at DESC);
  `);

  const columns = database.prepare("PRAGMA table_info(posts)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "source_id")) {
    database.exec("ALTER TABLE posts ADD COLUMN source_id TEXT");
  }
  if (!columns.some((column) => column.name === "source_url")) {
    database.exec("ALTER TABLE posts ADD COLUMN source_url TEXT");
  }
  database.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_source_id
      ON posts(source_id) WHERE source_id IS NOT NULL;
  `);

  return database;
}

export const db = globalForDb.juniorCoringaDb ?? openDatabase();

if (process.env.NODE_ENV !== "production") {
  globalForDb.juniorCoringaDb = db;
}

function mapPost(row: PostRow | undefined): Post | null {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
    category: row.category,
    status: row.status,
    coverImage: row.cover_image,
    featured: Boolean(row.featured),
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readingMinutes: row.reading_minutes,
  };
}

function mapGalleryItem(row: GalleryRow | undefined): GalleryItem | null {
  if (!row) return null;
  return {
    id: row.id,
    imageUrl: row.image_url,
    title: row.title,
    caption: row.caption,
    postId: row.post_id,
    postTitle: row.post_title,
    postSlug: row.post_slug,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

function getUniqueSlug(requested: string, ignoreId?: number) {
  const base = slugify(requested) || `publicacao-${Date.now()}`;
  let candidate = base;
  let suffix = 2;

  const query = ignoreId
    ? db.prepare("SELECT id FROM posts WHERE slug = ? AND id != ?")
    : db.prepare("SELECT id FROM posts WHERE slug = ?");

  while (ignoreId ? query.get(candidate, ignoreId) : query.get(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

export function listPublishedPosts(limit = 24) {
  const rows = db
    .prepare(
      `SELECT * FROM posts
       WHERE status = 'published'
       ORDER BY featured DESC, COALESCE(published_at, created_at) DESC
       LIMIT ?`,
    )
    .all(limit) as PostRow[];

  return rows.map((row) => mapPost(row) as Post);
}

export function listPublishedPostSummaries(limit = 500) {
  const rows = db
    .prepare(
      `SELECT
        id, title, slug, excerpt, '' AS content, category, status, cover_image, featured,
        published_at, created_at, updated_at,
        MAX(1, CAST(((LENGTH(content) - LENGTH(REPLACE(content, ' ', '')) + 1) + 209) / 210 AS INTEGER)) AS reading_minutes
       FROM posts
       WHERE status = 'published'
       ORDER BY featured DESC, COALESCE(published_at, created_at) DESC
       LIMIT ?`,
    )
    .all(limit) as PostRow[];

  return rows.map((row) => mapPost(row) as Post);
}

export function listAllPosts() {
  const rows = db
    .prepare("SELECT * FROM posts ORDER BY updated_at DESC")
    .all() as PostRow[];
  return rows.map((row) => mapPost(row) as Post);
}

export function getPublishedPost(slug: string) {
  return mapPost(
    db
      .prepare("SELECT * FROM posts WHERE slug = ? AND status = 'published'")
      .get(slug) as PostRow | undefined,
  );
}

export function getPostById(id: number) {
  return mapPost(db.prepare("SELECT * FROM posts WHERE id = ?").get(id) as PostRow | undefined);
}

export function createPost(input: PostInput) {
  const now = new Date().toISOString();
  const slug = getUniqueSlug(input.slug || input.title);
  const publishedAt = input.status === "published" ? now : null;

  const result = db
    .prepare(
      `INSERT INTO posts
        (title, slug, excerpt, content, category, status, cover_image, featured, published_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.title,
      slug,
      input.excerpt,
      input.content,
      input.category,
      input.status,
      input.coverImage || null,
      input.featured ? 1 : 0,
      publishedAt,
      now,
      now,
    );

  return getPostById(Number(result.lastInsertRowid)) as Post;
}

export function updatePost(id: number, input: PostInput) {
  const current = getPostById(id);
  if (!current) return null;

  const now = new Date().toISOString();
  const slug = getUniqueSlug(input.slug || input.title, id);
  const publishedAt =
    input.status === "published" ? current.publishedAt || now : null;

  db.prepare(
    `UPDATE posts SET
      title = ?, slug = ?, excerpt = ?, content = ?, category = ?, status = ?,
      cover_image = ?, featured = ?, published_at = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.title,
    slug,
    input.excerpt,
    input.content,
    input.category,
    input.status,
    input.coverImage || null,
    input.featured ? 1 : 0,
    publishedAt,
    now,
    id,
  );

  return getPostById(id);
}

export function deletePost(id: number) {
  return db.prepare("DELETE FROM posts WHERE id = ?").run(id).changes > 0;
}

export function getPostCounts() {
  const row = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts
       FROM posts`,
    )
    .get() as { total: number; published: number | null; drafts: number | null };

  return {
    total: row.total,
    published: row.published || 0,
    drafts: row.drafts || 0,
  };
}

const gallerySelect = `
  SELECT gallery_items.*, posts.title AS post_title, posts.slug AS post_slug
  FROM gallery_items
  LEFT JOIN posts ON posts.id = gallery_items.post_id
`;

export function listPublishedGalleryItems(limit = 16) {
  const rows = db.prepare(
    `${gallerySelect}
     WHERE gallery_items.status = 'published'
     ORDER BY gallery_items.sort_order ASC, gallery_items.created_at DESC
     LIMIT ?`,
  ).all(limit) as GalleryRow[];
  return rows.map((row) => mapGalleryItem(row) as GalleryItem);
}

export function listAllGalleryItems() {
  const rows = db.prepare(
    `${gallerySelect}
     ORDER BY gallery_items.sort_order ASC, gallery_items.created_at DESC`,
  ).all() as GalleryRow[];
  return rows.map((row) => mapGalleryItem(row) as GalleryItem);
}

export function getGalleryItem(id: number) {
  return mapGalleryItem(db.prepare(`${gallerySelect} WHERE gallery_items.id = ?`).get(id) as GalleryRow | undefined);
}

export function listPublishedPostOptions(): PostOption[] {
  return db.prepare(
    `SELECT id, title, slug FROM posts
     WHERE status = 'published'
     ORDER BY COALESCE(published_at, created_at) DESC`,
  ).all() as PostOption[];
}

export function createGalleryItems(inputs: GalleryItemInput[]) {
  const now = new Date().toISOString();
  const maximum = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS value FROM gallery_items").get() as { value: number };
  const insert = db.prepare(
    `INSERT INTO gallery_items
      (image_url, title, caption, post_id, status, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const createMany = db.transaction((items: GalleryItemInput[]) => items.map((item, index) => {
    const result = insert.run(
      item.imageUrl,
      item.title?.trim() || "",
      item.caption?.trim() || "",
      item.postId || null,
      item.status || "published",
      maximum.value + index + 1,
      now,
      now,
    );
    return Number(result.lastInsertRowid);
  }));

  return createMany(inputs).map((id) => getGalleryItem(id) as GalleryItem);
}

export function updateGalleryItem(id: number, input: GalleryItemInput) {
  const current = getGalleryItem(id);
  if (!current) return null;
  db.prepare(
    `UPDATE gallery_items SET
      image_url = ?, title = ?, caption = ?, post_id = ?, status = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    input.imageUrl,
    input.title?.trim() || "",
    input.caption?.trim() || "",
    input.postId || null,
    input.status || "published",
    new Date().toISOString(),
    id,
  );
  return getGalleryItem(id);
}

export function deleteGalleryItem(id: number) {
  return db.prepare("DELETE FROM gallery_items WHERE id = ?").run(id).changes > 0;
}

export function reorderGalleryItems(ids: number[]) {
  const update = db.prepare("UPDATE gallery_items SET sort_order = ?, updated_at = ? WHERE id = ?");
  const now = new Date().toISOString();
  db.transaction((orderedIds: number[]) => {
    orderedIds.forEach((id, index) => update.run(index, now, id));
  })(ids);
}
