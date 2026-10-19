import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import Database from "better-sqlite3";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import iconv from "iconv-lite";
import * as he from "he";
import sharp from "sharp";

const args = process.argv.slice(2);
const xmlPath = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
const downloadMedia = args.includes("--download-media");
const overwrite = args.includes("--overwrite");
const replaceImport = args.includes("--replace-import");

if (!xmlPath) {
  console.error("Uso: npm run import:wordpress -- <backup.xml> [--dry-run] [--download-media] [--overwrite] [--replace-import]");
  process.exit(1);
}

const resolvedXmlPath = path.resolve(xmlPath);
if (!fs.existsSync(resolvedXmlPath)) {
  console.error(`Arquivo não encontrado: ${resolvedXmlPath}`);
  process.exit(1);
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: false,
  trimValues: false,
  isArray: (_, jPath) =>
    ["rss.channel.item", "rss.channel.item.category", "rss.channel.item.wp:postmeta"].includes(jPath),
});

const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "_",
  strongDelimiter: "**",
});
turndown.use(gfm);
turndown.remove(["script", "style", "noscript", "iframe", "form", "button"]);

function mojibakeScore(value) {
  return (value.match(/[ÃÂâð�]/g) || []).length + (value.match(/â€|Âº|Âª|Ã./g) || []).length;
}

function repairEncoding(value) {
  let current = String(value ?? "");
  for (let pass = 0; pass < 2; pass += 1) {
    if (!mojibakeScore(current)) break;
    const repaired = iconv.decode(iconv.encode(current, "windows-1252"), "utf8");
    if (mojibakeScore(repaired) >= mojibakeScore(current)) break;
    current = repaired;
  }
  return current.replace(/\u00a0/g, " ").trim();
}

function textValue(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return repairEncoding(value);
  if (typeof value === "object" && "#text" in value) return repairEncoding(value["#text"]);
  return "";
}

function titleValue(item) {
  return he
    .decode(textValue(item?.title).replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return repairEncoding(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);
}

function toIso(value, fallback) {
  const normalized = String(value || "").trim().replace(" ", "T");
  if (!normalized || normalized.startsWith("0000-00-00")) return fallback;
  const date = new Date(`${normalized}Z`);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function metaValue(item, key) {
  const metadata = item["wp:postmeta"];
  const entries = Array.isArray(metadata) ? metadata : metadata ? [metadata] : [];
  const entry = entries.find((candidate) => textValue(candidate["wp:meta_key"]) === key);
  return entry ? textValue(entry["wp:meta_value"]) : "";
}

function categoryValues(item) {
  const entries = Array.isArray(item.category) ? item.category : item.category ? [item.category] : [];
  return entries
    .filter((entry) => typeof entry === "string" || entry?.["@_domain"] === "category")
    .map(textValue)
    .filter(Boolean);
}

function mapCategory(item, title, content) {
  const haystack = `${categoryValues(item).join(" ")} ${title} ${content.slice(0, 500)}`.toLowerCase();
  if (/autis|inclus|neurodiver|pcd|defici[eê]ncia/.test(haystack)) return "Inclusão";
  if (/agenda|sess[aã]o|audi[eê]ncia|evento|convite/.test(haystack)) return "Agenda";
  if (/projeto|lei|indica[cç][aã]o|requerimento|mo[cç][aã]o/.test(haystack)) return "Projeto";
  return "Notícia";
}

function suspiciousReason(item) {
  const title = titleValue(item);
  const slug = textValue(item["wp:post_name"]);
  const content = repairEncoding(textValue(item["content:encoded"]));
  const corpus = `${title}\n${slug}\n${content}`;
  const publishedAt = toIso(item["wp:post_date_gmt"] || item["wp:post_date"], "1970-01-01T00:00:00.000Z");
  if (publishedAt > "2026-05-13T00:00:00.000Z") {
    return "publicado após o início detectado da invasão de conteúdo";
  }
  const gamblingPattern = /\b(casinos?|cassinos?|1win|mostbet|pin\s*-?\s*up|robocat|mirax|bitcasino|betting|bookmakers?|gambling|jackpots?|slots?|sportbet|sportsbook|roleta|roulette|apostas?|poker\s+online|promo\s*codes?|free\s*spins?)\b/i;
  if (gamblingPattern.test(corpus)) return "conteúdo de cassino/apostas";
  if (/[\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff\u3400-\u9fff]/.test(`${title} ${content.slice(0, 1200)}`)) {
    return "conteúdo em idioma alheio ao site";
  }
  if (/\b(viagra|cialis|porn|escort|crypto\s+trading|payday\s+loan)\b/i.test(corpus)) {
    return "conteúdo típico de spam";
  }
  return null;
}

function cleanWordPressHtml(value) {
  return repairEncoding(value)
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/gi, "")
    .replace(/\[caption[^\]]*\]([\s\S]*?)\[\/caption\]/gi, "$1")
    .replace(/\[gallery[^\]]*\]/gi, "")
    .replace(/\[\/?[a-z][^\]]*\]/gi, "");
}

function htmlToMarkdown(html) {
  return turndown
    .turndown(cleanWordPressHtml(html))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\\([#*_`])/g, "$1")
    .trim();
}

function makeExcerpt(explicitExcerpt, markdown, title) {
  const source = htmlToMarkdown(explicitExcerpt) || markdown;
  const plain = source
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const excerpt = plain || title;
  return excerpt.length > 260 ? `${excerpt.slice(0, 257).trimEnd()}...` : excerpt;
}

function uniqueSlug(database, requested, sourceId) {
  const base = slugify(requested) || `publicacao-${sourceId}`;
  let candidate = base;
  let suffix = 2;
  while (database.prepare("SELECT 1 FROM posts WHERE slug = ? AND source_id != ?").get(candidate, sourceId)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

async function downloadAttachment(attachment, uploadDir) {
  if (!attachment.url || !/^https?:\/\//i.test(attachment.url)) return null;
  const outputName = `wp-${attachment.id}.webp`;
  const outputPath = path.join(uploadDir, outputName);
  if (fs.existsSync(outputPath)) return `/media/${outputName}`;

  const response = await fetch(attachment.url, {
    headers: { "User-Agent": "JuniorCoringaMigration/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 20 * 1024 * 1024) throw new Error("arquivo maior que 20 MB");
  await sharp(buffer, { animated: true })
    .rotate()
    .resize({ width: 1800, height: 1400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 85, alphaQuality: 90 })
    .toFile(outputPath);
  return `/media/${outputName}`;
}

async function mapWithConcurrency(values, concurrency, callback) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

const xml = await fsp.readFile(resolvedXmlPath, "utf8");
const parsed = parser.parse(xml);
const rawItems = parsed?.rss?.channel?.item || [];
const items = Array.isArray(rawItems) ? rawItems : [rawItems];

const attachments = items
  .filter((item) => textValue(item["wp:post_type"]) === "attachment")
  .map((item) => ({
    id: textValue(item["wp:post_id"]),
    parentId: textValue(item["wp:post_parent"]),
    url: textValue(item["wp:attachment_url"]),
  }))
  .filter((attachment) => attachment.id && attachment.url);

const candidatePosts = items.filter((item) => {
  const type = textValue(item["wp:post_type"]);
  const status = textValue(item["wp:status"]);
  return type === "post" && status !== "trash" && ["publish", "draft", "pending", "private"].includes(status);
});

const suspiciousPosts = candidatePosts
  .map((item) => ({ item, reason: suspiciousReason(item) }))
  .filter((entry) => entry.reason);
const suspiciousIds = new Set(suspiciousPosts.map(({ item }) => textValue(item["wp:post_id"])));
const posts = candidatePosts.filter((item) => !suspiciousIds.has(textValue(item["wp:post_id"])));

const categories = new Map();
for (const item of posts) {
  const title = titleValue(item);
  const content = htmlToMarkdown(textValue(item["content:encoded"]));
  const category = mapCategory(item, title, content);
  categories.set(category, (categories.get(category) || 0) + 1);
}

console.log(`Backup: ${resolvedXmlPath}`);
console.log(`Itens encontrados: ${items.length}`);
console.log(`Posts encontrados: ${candidatePosts.length}`);
console.log(`Spam bloqueado: ${suspiciousPosts.length}`);
console.log(`Posts importáveis: ${posts.length}`);
console.log(`  Publicados: ${posts.filter((item) => textValue(item["wp:status"]) === "publish").length}`);
console.log(`  Rascunhos: ${posts.filter((item) => textValue(item["wp:status"]) !== "publish").length}`);
console.log(`Anexos: ${attachments.length}`);
console.log(`Categorias: ${[...categories.entries()].map(([name, count]) => `${name}=${count}`).join(", ")}`);
console.log(`Exemplo corrigido: ${titleValue(posts[0]) || "sem título"}`);
console.log(`Tamanho do primeiro conteúdo: ${htmlToMarkdown(textValue(posts[0]?.["content:encoded"])).length} caracteres`);

if (dryRun) {
  console.log("Simulação concluída; nenhum dado foi alterado.");
  process.exit(0);
}

const dataDir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), "data"));
const uploadDir = path.join(dataDir, "uploads");
await fsp.mkdir(uploadDir, { recursive: true });

const databasePath = path.join(dataDir, "junior-coringa.sqlite");
const databaseExisted = fs.existsSync(databasePath);
const database = new Database(databasePath);
database.pragma("journal_mode = WAL");

if (databaseExisted) {
  const backupDir = path.join(dataDir, "backups");
  await fsp.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `antes-importacao-wordpress-${timestamp}.sqlite`);
  await database.backup(backupPath);
  console.log(`Backup do banco atual criado em: ${backupPath}`);
}

const reportDir = path.join(dataDir, "backups");
await fsp.mkdir(reportDir, { recursive: true });
const reportPath = path.join(reportDir, "relatorio-importacao-wordpress.json");
await fsp.writeFile(
  reportPath,
  JSON.stringify(
    {
      source: resolvedXmlPath,
      generatedAt: new Date().toISOString(),
      importedCandidates: posts.length,
      blockedAsSpam: suspiciousPosts.map(({ item, reason }) => ({
        wordpressId: textValue(item["wp:post_id"]),
        title: titleValue(item),
        url: textValue(item.link),
        reason,
      })),
    },
    null,
    2,
  ),
  "utf8",
);
console.log(`Relatório de segurança criado em: ${reportPath}`);

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
    updated_at TEXT NOT NULL,
    source_id TEXT,
    source_url TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_posts_publication ON posts(status, published_at DESC);
`);

const existingColumns = database.prepare("PRAGMA table_info(posts)").all().map((column) => column.name);
if (!existingColumns.includes("source_id")) database.exec("ALTER TABLE posts ADD COLUMN source_id TEXT");
if (!existingColumns.includes("source_url")) database.exec("ALTER TABLE posts ADD COLUMN source_url TEXT");
database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_posts_source_id ON posts(source_id) WHERE source_id IS NOT NULL");

if (replaceImport) {
  const importedCount = database
    .prepare("SELECT COUNT(*) AS count FROM posts WHERE source_id LIKE 'wordpress:%'")
    .get().count;
  database.prepare("DELETE FROM posts WHERE source_id LIKE 'wordpress:%'").run();
  console.log(`Importação anterior removida para substituição: ${importedCount} posts`);
}

const localMedia = new Map();
let mediaSuccess = 0;
let mediaFailed = 0;

if (downloadMedia) {
  console.log("Baixando e otimizando anexos...");
  await mapWithConcurrency(attachments, 4, async (attachment, index) => {
    try {
      const localUrl = await downloadAttachment(attachment, uploadDir);
      if (localUrl) {
        localMedia.set(attachment.id, localUrl);
        localMedia.set(attachment.url, localUrl);
        mediaSuccess += 1;
      }
    } catch (error) {
      mediaFailed += 1;
      console.warn(`  Falha no anexo ${attachment.id}: ${error.message}`);
    }
    if ((index + 1) % 25 === 0 || index + 1 === attachments.length) {
      console.log(`  ${index + 1}/${attachments.length} anexos processados`);
    }
  });
}

const findExisting = database.prepare("SELECT id FROM posts WHERE source_id = ?");
const insert = database.prepare(`
  INSERT INTO posts
    (title, slug, excerpt, content, category, status, cover_image, featured,
     published_at, created_at, updated_at, source_id, source_url)
  VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
`);
const update = database.prepare(`
  UPDATE posts SET
    title = ?, slug = ?, excerpt = ?, content = ?, category = ?, status = ?, cover_image = ?,
    published_at = ?, created_at = ?, updated_at = ?, source_url = ?
  WHERE source_id = ?
`);

let imported = 0;
let skipped = 0;
let updated = 0;

const importPosts = database.transaction(() => {
  for (const item of posts) {
    const wordpressId = textValue(item["wp:post_id"]);
    const sourceId = `wordpress:${wordpressId}`;
    const existing = findExisting.get(sourceId);
    if (existing && !overwrite) {
      skipped += 1;
      continue;
    }

    const now = new Date().toISOString();
    const title = titleValue(item) || `Publicação ${wordpressId}`;
    let content = htmlToMarkdown(textValue(item["content:encoded"]));
    for (const [remoteUrl, localUrl] of localMedia.entries()) {
      if (/^https?:\/\//i.test(remoteUrl)) content = content.split(remoteUrl).join(localUrl);
    }
    if (!content) content = title;
    const excerpt = makeExcerpt(textValue(item["excerpt:encoded"]), content, title);
    const status = textValue(item["wp:status"]) === "publish" ? "published" : "draft";
    const createdAt = toIso(item["wp:post_date_gmt"] || item["wp:post_date"], now);
    const updatedAt = toIso(item["wp:post_modified_gmt"] || item["wp:post_modified"], createdAt);
    const publishedAt = status === "published" ? createdAt : null;
    const thumbnailId = metaValue(item, "_thumbnail_id");
    const coverImage = localMedia.get(thumbnailId) || null;
    const category = mapCategory(item, title, content);
    const sourceUrl = textValue(item.link) || null;
    const slug = uniqueSlug(database, textValue(item["wp:post_name"]) || title, sourceId);

    const values = [title, slug, excerpt, content, category, status, coverImage, publishedAt, createdAt, updatedAt];
    if (existing) {
      update.run(...values, sourceUrl, sourceId);
      updated += 1;
    } else {
      insert.run(...values, sourceId, sourceUrl);
      imported += 1;
    }
  }
});

importPosts();
database.close();

console.log("Importação concluída.");
console.log(`  Novos posts: ${imported}`);
console.log(`  Atualizados: ${updated}`);
console.log(`  Ignorados por já existirem: ${skipped}`);
if (downloadMedia) console.log(`  Imagens salvas: ${mediaSuccess}; falhas: ${mediaFailed}`);
