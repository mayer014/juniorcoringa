import Database from "better-sqlite3";

const database = new Database("data/junior-coringa.sqlite", { readonly: true });
const counts = database.prepare(`
  SELECT
    COUNT(*) AS total,
    SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
    SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) AS drafts,
    SUM(CASE WHEN cover_image IS NOT NULL THEN 1 ELSE 0 END) AS covers,
    COUNT(DISTINCT slug) AS slugs
  FROM posts
`).get();
const latest = database.prepare(`
  SELECT title, slug, category, published_at
  FROM posts
  WHERE status = 'published'
  ORDER BY published_at DESC
  LIMIT 12
`).all();
const rows = database.prepare("SELECT id, title, content FROM posts").all();
const suspiciousPattern = /\b(casino|cassino|1win|mostbet|pin\s*-?\s*up|robocat|mirax|bitcasino|gambling|bookmaker)\b/i;
const suspicious = rows
  .filter((row) => suspiciousPattern.test(`${row.title} ${row.content}`))
  .map((row) => ({ id: row.id, title: row.title }));
const malformedTitles = rows
  .filter((row) => /<[^>]+>|&(?:amp|lt|gt|quot|#\d+);/i.test(row.title))
  .map((row) => ({ id: row.id, title: row.title }));
const encodingIssues = rows
  .filter((row) => /(?:Ã[£¡©í³º]|Â[ºª]|â[€˜€™œ“”–—]|�)/.test(`${row.title} ${row.content}`))
  .map((row) => ({ id: row.id, title: row.title }));

console.log(JSON.stringify({ counts, latest, suspicious, malformedTitles, encodingIssues }, null, 2));
database.close();
