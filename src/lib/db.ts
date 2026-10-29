import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import type { CamaraSyncRun, GalleryItem, GalleryItemInput, GalleryStatus, LegislativeEnrichmentStatus, LegislativeItem, LegislativeItemInput, LegislativeItemReviewInput, LegislativeKind, LegislativeStatusGroup, OfficialNewsCandidate, OfficialNewsQueueCounts, OfficialNewsQueueItem, Post, PostCategory, PostInput, PostOption, PostStatus } from "@/lib/types";

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
  source_id?: string | null;
  source_url?: string | null;
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

type LegislativeRow = {
  id: number;
  external_id: string;
  kind: LegislativeKind;
  type: string;
  number: string;
  year: number;
  title: string;
  summary: string;
  public_summary: string | null;
  author: string;
  status: string;
  status_group: LegislativeStatusGroup;
  source_url: string;
  location: string | null;
  neighborhood: string | null;
  service: string | null;
  reference: string | null;
  full_text: string | null;
  law_number: string | null;
  law_date: string | null;
  law_url: string | null;
  author_role: string | null;
  occurred_at: string;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
  published: number;
  featured: number;
  deleted: number;
  enrichment_status: LegislativeEnrichmentStatus;
  enrichment_error: string | null;
  enrichment_attempts: number;
  last_enrichment_at: string | null;
  auto_hidden: number;
  title_override: string | null;
  summary_override: string | null;
  service_override: string | null;
  location_override: string | null;
  neighborhood_override: string | null;
  reference_override: string | null;
};

type SyncRunRow = {
  id: number;
  started_at: string;
  heartbeat_at: string | null;
  finished_at: string | null;
  status: "running" | "success" | "error";
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  news_inserted: number;
  news_updated: number;
  news_found: number;
  news_pending: number;
  news_failed: number;
  mode: "daily" | "history" | "indications" | "news";
  trigger_source: "manual" | "scheduled";
  error: string | null;
};

type OfficialNewsQueueRow = {
  source_id: string;
  source_url: string;
  title: string;
  excerpt: string | null;
  image_url: string | null;
  published_at: string;
  status: "pending" | "complete" | "failed";
  attempts: number;
  last_error: string | null;
  first_seen_at: string;
  last_seen_at: string;
  last_attempt_at: string | null;
};

const globalForDb = globalThis as unknown as { juniorCoringaDb?: Database.Database };
const dataDir = path.resolve(
  /* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"),
);

function openDatabase() {
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

    CREATE TABLE IF NOT EXISTS legislative_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_id TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL CHECK(kind IN ('project', 'indication')),
      type TEXT NOT NULL,
      number TEXT NOT NULL,
      year INTEGER NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      public_summary TEXT,
      author TEXT NOT NULL,
      status TEXT NOT NULL,
      status_group TEXT NOT NULL CHECK(status_group IN ('processing', 'approved', 'archived', 'protocolled')),
      source_url TEXT NOT NULL,
      location TEXT,
      neighborhood TEXT,
      service TEXT,
      reference TEXT,
      full_text TEXT,
      law_number TEXT,
      law_date TEXT,
      law_url TEXT,
      author_role TEXT,
      occurred_at TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published INTEGER NOT NULL DEFAULT 1,
      featured INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      enrichment_status TEXT NOT NULL DEFAULT 'not_applicable',
      enrichment_error TEXT,
      enrichment_attempts INTEGER NOT NULL DEFAULT 0,
      last_enrichment_at TEXT,
      auto_hidden INTEGER NOT NULL DEFAULT 0,
      title_override TEXT,
      summary_override TEXT,
      service_override TEXT,
      location_override TEXT,
      neighborhood_override TEXT,
      reference_override TEXT,
      raw_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_legislative_publication
      ON legislative_items(published, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_legislative_filters
      ON legislative_items(kind, status_group, year);

    CREATE TABLE IF NOT EXISTS camara_sync_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      heartbeat_at TEXT,
      finished_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('running', 'success', 'error')),
      found INTEGER NOT NULL DEFAULT 0,
      inserted INTEGER NOT NULL DEFAULT 0,
      updated INTEGER NOT NULL DEFAULT 0,
      unchanged INTEGER NOT NULL DEFAULT 0,
      news_inserted INTEGER NOT NULL DEFAULT 0,
      news_updated INTEGER NOT NULL DEFAULT 0,
      news_found INTEGER NOT NULL DEFAULT 0,
      news_pending INTEGER NOT NULL DEFAULT 0,
      news_failed INTEGER NOT NULL DEFAULT 0,
      mode TEXT NOT NULL DEFAULT 'daily',
      trigger_source TEXT NOT NULL DEFAULT 'manual',
      error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_camara_sync_runs_started
      ON camara_sync_runs(started_at DESC);

    CREATE TABLE IF NOT EXISTS official_news_queue (
      source_id TEXT PRIMARY KEY,
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT,
      image_url TEXT,
      published_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'complete', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_attempt_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_official_news_queue_status
      ON official_news_queue(status, attempts, published_at DESC);
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

export function getDatabaseStorageStatus() {
  if (process.platform === "win32") return { dataDir, persistentMountDetected: true };
  try {
    const normalizedDataDir = path.resolve(dataDir);
    const mounts = fs.readFileSync("/proc/self/mountinfo", "utf8").split("\n");
    const persistentMountDetected = mounts.some((line) => {
      const fields = line.split(" ");
      const mountPoint = fields[4]?.replace(/\\040/g, " ").replace(/\\011/g, "\t");
      return mountPoint ? path.resolve(mountPoint) === normalizedDataDir : false;
    });
    return {
      dataDir,
      persistentMountDetected,
    };
  } catch {
    return { dataDir, persistentMountDetected: false };
  }
}

// Reaplica migrações aditivas durante Fast Refresh, quando a conexão global já existia.
db.exec(`
  CREATE TABLE IF NOT EXISTS legislative_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK(kind IN ('project', 'indication')),
    type TEXT NOT NULL,
    number TEXT NOT NULL,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    public_summary TEXT,
    author TEXT NOT NULL,
    status TEXT NOT NULL,
    status_group TEXT NOT NULL CHECK(status_group IN ('processing', 'approved', 'archived', 'protocolled')),
    source_url TEXT NOT NULL,
    location TEXT,
    neighborhood TEXT,
    service TEXT,
    reference TEXT,
    full_text TEXT,
    law_number TEXT,
    law_date TEXT,
    law_url TEXT,
    author_role TEXT,
    occurred_at TEXT NOT NULL,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published INTEGER NOT NULL DEFAULT 1,
    featured INTEGER NOT NULL DEFAULT 0,
    deleted INTEGER NOT NULL DEFAULT 0,
    enrichment_status TEXT NOT NULL DEFAULT 'not_applicable',
    enrichment_error TEXT,
    enrichment_attempts INTEGER NOT NULL DEFAULT 0,
    last_enrichment_at TEXT,
    auto_hidden INTEGER NOT NULL DEFAULT 0,
    title_override TEXT,
    summary_override TEXT,
    service_override TEXT,
    location_override TEXT,
    neighborhood_override TEXT,
    reference_override TEXT,
    raw_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_legislative_publication
    ON legislative_items(published, occurred_at DESC);
  CREATE INDEX IF NOT EXISTS idx_legislative_filters
    ON legislative_items(kind, status_group, year);
  CREATE TABLE IF NOT EXISTS camara_sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    heartbeat_at TEXT,
    finished_at TEXT,
    status TEXT NOT NULL CHECK(status IN ('running', 'success', 'error')),
    found INTEGER NOT NULL DEFAULT 0,
    inserted INTEGER NOT NULL DEFAULT 0,
    updated INTEGER NOT NULL DEFAULT 0,
    unchanged INTEGER NOT NULL DEFAULT 0,
    news_inserted INTEGER NOT NULL DEFAULT 0,
    news_updated INTEGER NOT NULL DEFAULT 0,
    news_found INTEGER NOT NULL DEFAULT 0,
    news_pending INTEGER NOT NULL DEFAULT 0,
    news_failed INTEGER NOT NULL DEFAULT 0,
    mode TEXT NOT NULL DEFAULT 'daily',
    trigger_source TEXT NOT NULL DEFAULT 'manual',
    error TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_camara_sync_runs_started
    ON camara_sync_runs(started_at DESC);
  CREATE TABLE IF NOT EXISTS official_news_queue (
    source_id TEXT PRIMARY KEY,
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    image_url TEXT,
    published_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'complete', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    last_attempt_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_official_news_queue_status
    ON official_news_queue(status, attempts, published_at DESC);
`);

const legislativeColumns = db.prepare("PRAGMA table_info(legislative_items)").all() as Array<{ name: string }>;
const addingEnrichmentStatus = !legislativeColumns.some((column) => column.name === "enrichment_status");
const legislativeMigrations = [
  ["location", "TEXT"],
  ["neighborhood", "TEXT"],
  ["service", "TEXT"],
  ["reference", "TEXT"],
  ["full_text", "TEXT"],
  ["public_summary", "TEXT"],
  ["law_number", "TEXT"],
  ["law_date", "TEXT"],
  ["law_url", "TEXT"],
  ["author_role", "TEXT"],
  ["published", "INTEGER NOT NULL DEFAULT 1"],
  ["featured", "INTEGER NOT NULL DEFAULT 0"],
  ["deleted", "INTEGER NOT NULL DEFAULT 0"],
  ["enrichment_status", "TEXT NOT NULL DEFAULT 'not_applicable'"],
  ["enrichment_error", "TEXT"],
  ["enrichment_attempts", "INTEGER NOT NULL DEFAULT 0"],
  ["last_enrichment_at", "TEXT"],
  ["auto_hidden", "INTEGER NOT NULL DEFAULT 0"],
  ["title_override", "TEXT"],
  ["summary_override", "TEXT"],
  ["service_override", "TEXT"],
  ["location_override", "TEXT"],
  ["neighborhood_override", "TEXT"],
  ["reference_override", "TEXT"],
] as const;
for (const [name, type] of legislativeMigrations) {
  if (!legislativeColumns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE legislative_items ADD COLUMN ${name} ${type}`);
  }
}
if (addingEnrichmentStatus) {
  db.exec(`
    UPDATE legislative_items
    SET enrichment_status = CASE
      WHEN kind <> 'indication' OR lower(type) NOT LIKE 'indica%' THEN 'not_applicable'
      WHEN coalesce(trim(location), '') <> '' OR coalesce(trim(neighborhood), '') <> '' THEN 'complete'
      ELSE 'pending'
    END;
    UPDATE legislative_items
    SET published = 0, auto_hidden = 1
    WHERE kind = 'indication'
      AND lower(type) LIKE 'indica%'
      AND enrichment_status = 'pending'
      AND published = 1;
    UPDATE legislative_items
    SET published = 0, auto_hidden = 1
    WHERE kind = 'indication' AND lower(type) NOT LIKE 'indica%' AND published = 1;
  `);
}

const syncRunColumns = db.prepare("PRAGMA table_info(camara_sync_runs)").all() as Array<{ name: string }>;
const syncRunMigrations = [
  ["heartbeat_at", "TEXT"],
  ["unchanged", "INTEGER NOT NULL DEFAULT 0"],
  ["news_updated", "INTEGER NOT NULL DEFAULT 0"],
  ["news_found", "INTEGER NOT NULL DEFAULT 0"],
  ["news_pending", "INTEGER NOT NULL DEFAULT 0"],
  ["news_failed", "INTEGER NOT NULL DEFAULT 0"],
  ["mode", "TEXT NOT NULL DEFAULT 'daily'"],
  ["trigger_source", "TEXT NOT NULL DEFAULT 'manual'"],
] as const;
for (const [name, type] of syncRunMigrations) {
  if (!syncRunColumns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE camara_sync_runs ADD COLUMN ${name} ${type}`);
  }
}

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

function mapLegislativeItem(row: LegislativeRow | undefined): LegislativeItem | null {
  if (!row) return null;
  return {
    id: row.id,
    externalId: row.external_id,
    kind: row.kind,
    type: row.type,
    number: row.number,
    year: row.year,
    title: row.title_override || row.title,
    summary: row.summary,
    publicSummary: row.summary_override || row.public_summary || row.summary,
    author: row.author,
    status: row.status,
    statusGroup: row.status_group,
    sourceUrl: row.source_url,
    location: row.location_override || row.location,
    neighborhood: row.neighborhood_override || row.neighborhood,
    service: row.service_override || row.service,
    reference: row.reference_override || row.reference,
    fullText: row.full_text,
    lawNumber: row.law_number,
    lawDate: row.law_date,
    lawUrl: row.law_url,
    authorRole: row.author_role,
    occurredAt: row.occurred_at,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
    published: Boolean(row.published),
    featured: Boolean(row.featured),
    enrichmentStatus: row.enrichment_status,
    enrichmentError: row.enrichment_error,
    enrichmentAttempts: row.enrichment_attempts,
    lastEnrichmentAt: row.last_enrichment_at,
    titleOverride: row.title_override,
    summaryOverride: row.summary_override,
    serviceOverride: row.service_override,
    locationOverride: row.location_override,
    neighborhoodOverride: row.neighborhood_override,
    referenceOverride: row.reference_override,
  };
}

function mapSyncRun(row: SyncRunRow | undefined): CamaraSyncRun | null {
  if (!row) return null;
  return {
    id: row.id,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status,
    found: row.found,
    inserted: row.inserted,
    updated: row.updated,
    unchanged: row.unchanged,
    newsInserted: row.news_inserted,
    newsUpdated: row.news_updated,
    newsFound: row.news_found,
    newsPending: row.news_pending,
    newsFailed: row.news_failed,
    mode: row.mode,
    triggerSource: row.trigger_source,
    error: row.error,
  };
}

function mapOfficialNewsQueueItem(row: OfficialNewsQueueRow): OfficialNewsQueueItem {
  return {
    sourceId: row.source_id,
    sourceUrl: row.source_url,
    title: row.title,
    excerpt: row.excerpt,
    imageUrl: row.image_url,
    publishedAt: row.published_at,
    status: row.status,
    attempts: row.attempts,
    lastError: row.last_error,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    lastAttemptAt: row.last_attempt_at,
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

export function listLegislativeItems(options: {
  kind?: LegislativeKind;
  statusGroup?: LegislativeStatusGroup;
  year?: number;
  limit?: number;
  offset?: number;
  query?: string;
} = {}) {
  const clauses = ["published = 1", "deleted = 0"];
  const values: Array<string | number> = [];
  if (options.kind) {
    clauses.push("kind = ?");
    values.push(options.kind);
  }
  if (options.statusGroup) {
    clauses.push("status_group = ?");
    values.push(options.statusGroup);
  }
  if (options.year) {
    clauses.push("year = ?");
    values.push(options.year);
  }
  if (options.query?.trim()) {
    const query = `%${options.query.trim()}%`;
    clauses.push("(coalesce(title_override, title) LIKE ? OR coalesce(summary_override, public_summary, summary) LIKE ? OR coalesce(location_override, location) LIKE ? OR coalesce(neighborhood_override, neighborhood) LIKE ? OR coalesce(service_override, service) LIKE ? OR coalesce(reference_override, reference) LIKE ? OR number LIKE ?)");
    values.push(query, query, query, query, query, query, query);
  }
  values.push(Math.min(Math.max(options.limit ?? 250, 1), 500));
  values.push(Math.max(options.offset ?? 0, 0));
  const rows = db.prepare(
    `SELECT * FROM legislative_items
     WHERE ${clauses.join(" AND ")}
     ORDER BY featured DESC, occurred_at DESC, id DESC
     LIMIT ? OFFSET ?`,
  ).all(...values) as LegislativeRow[];
  return rows.map((row) => mapLegislativeItem(row) as LegislativeItem);
}

export function countLegislativeItems(options: {
  kind?: LegislativeKind;
  statusGroup?: LegislativeStatusGroup;
  year?: number;
  query?: string;
} = {}) {
  const clauses = ["published = 1", "deleted = 0"];
  const values: Array<string | number> = [];
  if (options.kind) { clauses.push("kind = ?"); values.push(options.kind); }
  if (options.statusGroup) { clauses.push("status_group = ?"); values.push(options.statusGroup); }
  if (options.year) { clauses.push("year = ?"); values.push(options.year); }
  if (options.query?.trim()) {
    const query = `%${options.query.trim()}%`;
    clauses.push("(coalesce(title_override, title) LIKE ? OR coalesce(summary_override, public_summary, summary) LIKE ? OR coalesce(location_override, location) LIKE ? OR coalesce(neighborhood_override, neighborhood) LIKE ? OR coalesce(service_override, service) LIKE ? OR coalesce(reference_override, reference) LIKE ? OR number LIKE ?)");
    values.push(query, query, query, query, query, query, query);
  }
  const row = db.prepare(`SELECT COUNT(*) AS total FROM legislative_items WHERE ${clauses.join(" AND ")}`).get(...values) as { total: number };
  return row.total;
}

export function listLegislativeYears() {
  return (db.prepare("SELECT DISTINCT year FROM legislative_items WHERE published = 1 AND deleted = 0 ORDER BY year DESC").all() as Array<{ year: number }>).map((row) => row.year);
}

export function getLegislativeItemByExternalId(externalId: string) {
  return mapLegislativeItem(
    db.prepare("SELECT * FROM legislative_items WHERE external_id = ?").get(externalId) as LegislativeRow | undefined,
  );
}

export function getLegislativeItem(id: number) {
  return mapLegislativeItem(
    db.prepare("SELECT * FROM legislative_items WHERE id = ? AND published = 1 AND deleted = 0").get(id) as LegislativeRow | undefined,
  );
}

export function getLegislativeCounts() {
  const row = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN kind = 'indication' AND lower(type) LIKE 'indica%' THEN 1 ELSE 0 END) AS indications,
      SUM(CASE WHEN kind = 'project' AND status_group = 'processing' THEN 1 ELSE 0 END) AS processing,
      SUM(CASE WHEN kind = 'project' AND status_group = 'approved' THEN 1 ELSE 0 END) AS approved
    FROM legislative_items WHERE published = 1 AND deleted = 0
  `).get() as { total: number; indications: number | null; processing: number | null; approved: number | null };
  return {
    total: row.total,
    indications: row.indications ?? 0,
    processing: row.processing ?? 0,
    approved: row.approved ?? 0,
  };
}

export function getLegislativeQualityCounts() {
  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN enrichment_status = 'complete' THEN 1 ELSE 0 END) AS complete,
      SUM(CASE WHEN enrichment_status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN enrichment_status = 'failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN enrichment_status = 'manual_review' THEN 1 ELSE 0 END) AS manual_review
    FROM legislative_items
    WHERE deleted = 0 AND kind = 'indication' AND lower(type) LIKE 'indica%'
  `).get() as { complete: number | null; pending: number | null; failed: number | null; manual_review: number | null };
  return {
    complete: row.complete ?? 0,
    pending: row.pending ?? 0,
    failed: row.failed ?? 0,
    manualReview: row.manual_review ?? 0,
  };
}

export function updateLegislativeItemTitle(id: number, title: string) {
  const now = new Date().toISOString();
  return db.prepare(`
    UPDATE legislative_items
    SET title = ?, updated_at = ?
    WHERE id = ? AND title <> ?
  `).run(title, now, id, title).changes > 0;
}

export function listAdminLegislativeItems(options: {
  kind?: LegislativeKind;
  visibility?: "published" | "hidden";
  quality?: "pending" | "failed" | "manual_review" | "complete";
  query?: string;
  limit?: number;
  offset?: number;
} = {}) {
  const clauses = ["deleted = 0"];
  const values: Array<string | number> = [];
  if (options.kind) {
    clauses.push("kind = ?");
    values.push(options.kind);
  }
  if (options.visibility) {
    clauses.push("published = ?");
    values.push(options.visibility === "published" ? 1 : 0);
  }
  if (options.quality) {
    clauses.push("enrichment_status = ?");
    values.push(options.quality);
  }
  if (options.query?.trim()) {
    const query = `%${options.query.trim()}%`;
    clauses.push("(coalesce(title_override, title) LIKE ? OR coalesce(summary_override, public_summary, summary) LIKE ? OR coalesce(location_override, location) LIKE ? OR coalesce(neighborhood_override, neighborhood) LIKE ? OR coalesce(reference_override, reference) LIKE ? OR number LIKE ? OR law_number LIKE ?)");
    values.push(query, query, query, query, query, query, query);
  }
  values.push(Math.min(Math.max(options.limit ?? 50, 1), 100));
  values.push(Math.max(options.offset ?? 0, 0));
  const rows = db.prepare(`
    SELECT * FROM legislative_items
    WHERE ${clauses.join(" AND ")}
    ORDER BY featured DESC, occurred_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(...values) as LegislativeRow[];
  return rows.map((row) => mapLegislativeItem(row) as LegislativeItem);
}

export function countAdminLegislativeItems(options: {
  kind?: LegislativeKind;
  visibility?: "published" | "hidden";
  quality?: "pending" | "failed" | "manual_review" | "complete";
  query?: string;
} = {}) {
  const clauses = ["deleted = 0"];
  const values: Array<string | number> = [];
  if (options.kind) {
    clauses.push("kind = ?");
    values.push(options.kind);
  }
  if (options.visibility) {
    clauses.push("published = ?");
    values.push(options.visibility === "published" ? 1 : 0);
  }
  if (options.quality) {
    clauses.push("enrichment_status = ?");
    values.push(options.quality);
  }
  if (options.query?.trim()) {
    const query = `%${options.query.trim()}%`;
    clauses.push("(coalesce(title_override, title) LIKE ? OR coalesce(summary_override, public_summary, summary) LIKE ? OR coalesce(location_override, location) LIKE ? OR coalesce(neighborhood_override, neighborhood) LIKE ? OR coalesce(reference_override, reference) LIKE ? OR number LIKE ? OR law_number LIKE ?)");
    values.push(query, query, query, query, query, query, query);
  }
  const row = db.prepare(`SELECT COUNT(*) AS total FROM legislative_items WHERE ${clauses.join(" AND ")}`).get(...values) as { total: number };
  return row.total;
}

export function updateLegislativeVisibility(id: number, published: boolean) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE legislative_items
    SET published = ?, auto_hidden = 0, updated_at = ?
    WHERE id = ? AND deleted = 0
  `).run(published ? 1 : 0, now, id);
  if (!result.changes) return null;
  return mapLegislativeItem(db.prepare("SELECT * FROM legislative_items WHERE id = ?").get(id) as LegislativeRow | undefined);
}

export function updateLegislativeFeatured(id: number, featured: boolean) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE legislative_items
    SET featured = ?, updated_at = ?
    WHERE id = ? AND kind = 'project' AND deleted = 0
  `).run(featured ? 1 : 0, now, id);
  if (!result.changes) return null;
  return mapLegislativeItem(db.prepare("SELECT * FROM legislative_items WHERE id = ?").get(id) as LegislativeRow | undefined);
}

export function updateLegislativeReview(id: number, input: LegislativeItemReviewInput) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE legislative_items SET
      title_override = ?, summary_override = ?, service_override = ?, location_override = ?,
      neighborhood_override = ?, reference_override = ?, enrichment_status = ?,
      enrichment_error = NULL, auto_hidden = 0, updated_at = ?
    WHERE id = ? AND deleted = 0
  `).run(
    input.title, input.publicSummary, input.service, input.location,
    input.neighborhood, input.reference, input.enrichmentStatus, now, id,
  );
  if (!result.changes) return null;
  return mapLegislativeItem(db.prepare("SELECT * FROM legislative_items WHERE id = ?").get(id) as LegislativeRow | undefined);
}

export function deleteLegislativeItem(id: number) {
  const now = new Date().toISOString();
  return db.prepare(`
    UPDATE legislative_items
    SET deleted = 1, published = 0, updated_at = ?
    WHERE id = ? AND deleted = 0
  `).run(now, id).changes > 0;
}

export function upsertLegislativeItem(input: LegislativeItemInput) {
  const existing = db.prepare(
    "SELECT * FROM legislative_items WHERE external_id = ?",
  ).get(input.externalId) as LegislativeRow | undefined;
  const now = new Date().toISOString();
  const enrichmentAttempt = input.enrichmentAttempted ? 1 : 0;
  const initialPublished = input.initialPublished ?? input.enrichmentStatus !== "pending";
  if (!existing) {
    db.prepare(`
      INSERT INTO legislative_items
        (external_id, kind, type, number, year, title, summary, public_summary, author, status, status_group,
         source_url, location, neighborhood, service, reference, full_text, law_number, law_date, law_url,
         author_role, occurred_at, first_seen_at, last_seen_at, updated_at, published, auto_hidden,
         enrichment_status, enrichment_error, enrichment_attempts, last_enrichment_at, raw_json)
      VALUES
        (@externalId, @kind, @type, @number, @year, @title, @summary, @publicSummary, @author, @status, @statusGroup,
         @sourceUrl, @location, @neighborhood, @service, @reference, @fullText, @lawNumber, @lawDate, @lawUrl,
         @authorRole, @occurredAt, @now, @now, @now, @published, @autoHidden,
         @enrichmentStatus, @enrichmentError, @enrichmentAttempts, @lastEnrichmentAt, @rawJson)
    `).run({
      ...input,
      published: initialPublished ? 1 : 0,
      autoHidden: initialPublished ? 0 : 1,
      enrichmentAttempts: enrichmentAttempt,
      lastEnrichmentAt: enrichmentAttempt ? now : null,
      rawJson: input.rawJson ?? null,
      now,
    });
    return "inserted" as const;
  }

  const changed = existing.type !== input.type || existing.number !== input.number || existing.year !== input.year ||
    existing.title !== input.title || existing.summary !== input.summary || existing.public_summary !== input.publicSummary || existing.author !== input.author ||
    existing.status !== input.status || existing.status_group !== input.statusGroup ||
    existing.source_url !== input.sourceUrl || existing.location !== input.location ||
    existing.neighborhood !== input.neighborhood || existing.service !== input.service ||
    existing.reference !== input.reference || existing.enrichment_status !== input.enrichmentStatus ||
    existing.enrichment_error !== input.enrichmentError ||
    existing.full_text !== input.fullText || existing.law_number !== input.lawNumber ||
    existing.law_date !== input.lawDate || existing.law_url !== input.lawUrl ||
    existing.author_role !== input.authorRole || existing.occurred_at !== input.occurredAt;
  db.prepare(`
    UPDATE legislative_items SET
      kind = @kind, type = @type, number = @number, year = @year, title = @title, summary = @summary,
      public_summary = @publicSummary, author = @author, status = @status, status_group = @statusGroup,
      source_url = @sourceUrl, location = @location, neighborhood = @neighborhood, service = @service,
      reference = @reference, full_text = @fullText, law_number = @lawNumber, law_date = @lawDate,
      law_url = @lawUrl, author_role = @authorRole, occurred_at = @occurredAt, last_seen_at = @now,
      enrichment_status = @enrichmentStatus, enrichment_error = @enrichmentError,
      enrichment_attempts = enrichment_attempts + @enrichmentAttempt,
      last_enrichment_at = CASE WHEN @enrichmentAttempt = 1 THEN @now ELSE last_enrichment_at END,
      published = CASE
        WHEN @enrichmentStatus = 'complete' AND auto_hidden = 1 THEN 1
        WHEN @enrichmentStatus IN ('pending', 'failed', 'manual_review') AND published = 1 AND title_override IS NULL THEN 0
        ELSE published
      END,
      auto_hidden = CASE
        WHEN @enrichmentStatus = 'complete' AND auto_hidden = 1 THEN 0
        WHEN @enrichmentStatus IN ('pending', 'failed', 'manual_review') AND published = 1 AND title_override IS NULL THEN 1
        ELSE auto_hidden
      END,
      updated_at = CASE WHEN @changed = 1 THEN @now ELSE updated_at END, raw_json = @rawJson
    WHERE id = @id
  `).run({
    ...input,
    enrichmentAttempt,
    changed: changed ? 1 : 0,
    rawJson: input.rawJson ?? null,
    now,
    id: existing.id,
  });
  return changed ? "updated" as const : "unchanged" as const;
}

function officialNewsPublicationId(value: string) {
  try {
    return new URL(value).pathname.match(/\/(\d+)\/?$/)?.[1] ?? null;
  } catch {
    return value.match(/\/(\d+)\/?(?:#.*)?$/)?.[1] ?? null;
  }
}

function findOfficialNewsPost(input: { sourceId: string; sourceUrl: string }) {
  const publicationId = officialNewsPublicationId(input.sourceUrl) || input.sourceId.match(/(\d+)$/)?.[1];
  if (!publicationId) {
    return db.prepare("SELECT * FROM posts WHERE source_id = ? OR source_url = ? LIMIT 1")
      .get(input.sourceId, input.sourceUrl) as PostRow | undefined;
  }
  return db.prepare(`
    SELECT * FROM posts
    WHERE source_id = ? OR source_url = ?
       OR source_url LIKE ? OR source_url LIKE ?
    LIMIT 1
  `).get(input.sourceId, input.sourceUrl, `%/${publicationId}`, `%/${publicationId}#%`) as PostRow | undefined;
}

export function upsertOfficialNewsCandidate(input: OfficialNewsCandidate) {
  const now = new Date().toISOString();
  const alreadyPublished = Boolean(findOfficialNewsPost(input));
  const existing = db.prepare("SELECT source_id FROM official_news_queue WHERE source_id = ?")
    .get(input.sourceId) as { source_id: string } | undefined;
  db.prepare(`
    INSERT INTO official_news_queue
      (source_id, source_url, title, excerpt, image_url, published_at, status, attempts,
       last_error, first_seen_at, last_seen_at, last_attempt_at)
    VALUES
      (@sourceId, @sourceUrl, @title, @excerpt, @imageUrl, @publishedAt, @status, 0,
       NULL, @now, @now, NULL)
    ON CONFLICT(source_id) DO UPDATE SET
      source_url = excluded.source_url,
      title = excluded.title,
      excerpt = COALESCE(excluded.excerpt, official_news_queue.excerpt),
      image_url = COALESCE(excluded.image_url, official_news_queue.image_url),
      published_at = excluded.published_at,
      last_seen_at = excluded.last_seen_at,
      status = CASE WHEN @alreadyPublished = 1 THEN 'complete' ELSE official_news_queue.status END,
      last_error = CASE WHEN @alreadyPublished = 1 THEN NULL ELSE official_news_queue.last_error END
  `).run({ ...input, status: alreadyPublished ? "complete" : "pending", alreadyPublished: alreadyPublished ? 1 : 0, now });
  return existing ? "existing" as const : "inserted" as const;
}

export function listOfficialNewsCandidatesForEnrichment(limit = 50) {
  const rows = db.prepare(`
    SELECT * FROM official_news_queue
    WHERE status <> 'complete'
    ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, attempts ASC, published_at DESC
    LIMIT ?
  `).all(limit) as OfficialNewsQueueRow[];
  return rows.map(mapOfficialNewsQueueItem);
}

export function markOfficialNewsCandidateComplete(sourceId: string) {
  db.prepare(`
    UPDATE official_news_queue
    SET status = 'complete', attempts = attempts + 1, last_error = NULL, last_attempt_at = ?
    WHERE source_id = ?
  `).run(new Date().toISOString(), sourceId);
}

export function markOfficialNewsCandidateFailed(sourceId: string, error: string) {
  db.prepare(`
    UPDATE official_news_queue
    SET status = 'failed', attempts = attempts + 1, last_error = ?, last_attempt_at = ?
    WHERE source_id = ?
  `).run(error.slice(0, 1000), new Date().toISOString(), sourceId);
}

export function getOfficialNewsQueueCounts(): OfficialNewsQueueCounts {
  const row = db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) AS complete,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
    FROM official_news_queue
  `).get() as { total: number; complete: number | null; pending: number | null; failed: number | null };
  return {
    total: row.total,
    complete: row.complete ?? 0,
    pending: row.pending ?? 0,
    failed: row.failed ?? 0,
  };
}

export function createOfficialNewsPost(input: {
  sourceId: string;
  sourceUrl: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  coverImage: string | null;
  publishedAt: string;
}) {
  const existing = findOfficialNewsPost(input);
  const now = new Date().toISOString();
  if (existing) {
    const coverImage = input.coverImage || existing.cover_image;
    const excerpt = input.excerpt || existing.excerpt;
    const content = input.content || existing.content;
    const changed = existing.title !== input.title || existing.excerpt !== excerpt ||
      existing.content !== content || existing.cover_image !== coverImage ||
      existing.published_at !== input.publishedAt;
    if (!changed) return "unchanged" as const;
    db.prepare(`
      UPDATE posts SET title = ?, excerpt = ?, content = ?, cover_image = ?, published_at = ?,
        updated_at = ?, source_id = ?, source_url = ? WHERE id = ?
    `).run(input.title, excerpt, content, coverImage, input.publishedAt, now, input.sourceId, input.sourceUrl, existing.id);
    return "updated" as const;
  }
  const slug = getUniqueSlug(input.title);
  const excerpt = input.excerpt || "Notícia publicada pela Câmara Municipal de Campo Grande sobre a atuação do vereador Junior Coringa.";
  const content = input.content || `${excerpt}\n\n[Leia a matéria completa na Câmara Municipal](${input.sourceUrl})`;
  db.prepare(`
    INSERT INTO posts
      (title, slug, excerpt, content, category, status, cover_image, featured, published_at,
       created_at, updated_at, source_id, source_url)
    VALUES (?, ?, ?, ?, 'Notícia', 'published', ?, 0, ?, ?, ?, ?, ?)
  `).run(input.title, slug, excerpt, content, input.coverImage, input.publishedAt, now, now, input.sourceId, input.sourceUrl);
  return "inserted" as const;
}

export function startCamaraSyncRun(mode: "daily" | "history" | "indications" | "news", triggerSource: "manual" | "scheduled") {
  const acquire = db.transaction(() => {
    const now = new Date().toISOString();
    const staleCutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE camara_sync_runs
      SET finished_at = ?, status = 'error', error = ?
      WHERE status = 'running' AND (heartbeat_at IS NULL OR heartbeat_at < ?)
    `).run(now, "Sincronização anterior interrompida; o bloqueio foi recuperado automaticamente.", staleCutoff);

    const running = db.prepare("SELECT 1 FROM camara_sync_runs WHERE status = 'running' LIMIT 1").get();
    if (running) return null;

    const result = db.prepare(`
      INSERT INTO camara_sync_runs (started_at, heartbeat_at, status, mode, trigger_source)
      VALUES (?, ?, 'running', ?, ?)
    `).run(now, now, mode, triggerSource);
    return Number(result.lastInsertRowid);
  });
  return acquire.immediate();
}

export function heartbeatCamaraSyncRun(id: number) {
  db.prepare("UPDATE camara_sync_runs SET heartbeat_at = ? WHERE id = ? AND status = 'running'")
    .run(new Date().toISOString(), id);
}

export function finishCamaraSyncRun(id: number, result: {
  status: "success" | "error";
  found?: number;
  inserted?: number;
  updated?: number;
  unchanged?: number;
  newsInserted?: number;
  newsUpdated?: number;
  newsFound?: number;
  newsPending?: number;
  newsFailed?: number;
  error?: string | null;
}) {
  db.prepare(`
    UPDATE camara_sync_runs SET finished_at = ?, status = ?, found = ?, inserted = ?, updated = ?,
      unchanged = ?, news_inserted = ?, news_updated = ?, news_found = ?, news_pending = ?,
      news_failed = ?, error = ? WHERE id = ?
  `).run(
    new Date().toISOString(), result.status, result.found ?? 0, result.inserted ?? 0,
    result.updated ?? 0, result.unchanged ?? 0, result.newsInserted ?? 0,
    result.newsUpdated ?? 0, result.newsFound ?? 0, result.newsPending ?? 0,
    result.newsFailed ?? 0, result.error ?? null, id,
  );
}

export function getLatestCamaraSyncRun() {
  return mapSyncRun(
    db.prepare("SELECT * FROM camara_sync_runs ORDER BY id DESC LIMIT 1").get() as SyncRunRow | undefined,
  );
}

export function reorderGalleryItems(ids: number[]) {
  const update = db.prepare("UPDATE gallery_items SET sort_order = ?, updated_at = ? WHERE id = ?");
  const now = new Date().toISOString();
  db.transaction((orderedIds: number[]) => {
    orderedIds.forEach((id, index) => update.run(index, now, id));
  })(ids);
}
