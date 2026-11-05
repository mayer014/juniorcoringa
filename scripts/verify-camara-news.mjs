// Run after `npm run build`. Uses an isolated database and temporary credentials.
// --live checks the real Câmara archive and the three articles reported missing.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const live = process.argv.includes("--live");
const blockedArchive = process.argv.includes("--blocked-archive");
const recoveryOnly = process.argv.includes("--recovery-only");
const standalone = process.argv.includes("--standalone");
const exportRecovery = process.argv.includes("--export-recovery");
if (exportRecovery && !live) throw new Error("O acervo de recuperação só pode ser gerado com a fonte oficial real (--live).");
const taskData = mkdtempSync(path.join(tmpdir(), "junior-camara-http-test-"));
const ids = ["40257", "40215", "39428"];
const article = "O vereador Junior Coringa acompanhou as demandas dos moradores e solicitou melhorias na iluminação pública. A iniciativa atende à comunidade das Moreninhas, com instalação de postes e reforço da segurança nas ruas do bairro.";
let archiveUnavailable = false;
let latestItemEnabled = false;
let interruptUpdate = false;
const apiRequests = [];
const fixture = createServer((request, response) => {
  const url = new URL(request.url, "http://fixture.test");
  if (archiveUnavailable || recoveryOnly || (blockedArchive && /^\/(?:camara|imprensa)\//.test(url.pathname))) {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<!DOCTYPE html><title>Bot Verification</title><form class='lsrecaptcha-form'></form>");
    return;
  }
  if (url.pathname === "/api") {
    const page = Number(url.searchParams.get("pagina"));
    apiRequests.push(page);
    if (interruptUpdate && page === 2) {
      response.writeHead(502); response.end("upstream unavailable"); return;
    }
    const pageIds = page === 1 ? [ids[0]] : page === 2 ? ids.slice(1) : [];
    response.setHeader("Content-Type", "application/json");
    const entry = (id, date) => ({ titulo: `Junior Coringa: matéria ${id}`,
      data: date, resumo: "", imagem: `http://127.0.0.1:${fixturePort}/news/capa.png`,
      link: `http://127.0.0.1:${fixturePort}/camara/membros/show/14/noticias/1/${id}` });
    let entries = pageIds.map((id) => entry(id, page === 1 ? "2026-10-14 13:23:00" : "2026-09-01 13:23:00"));
    if (latestItemEnabled && page === 1) entries.unshift(entry("50000", "2026-11-05 12:00:00"));
    if (interruptUpdate && page === 1) entries = [entry("50001", "2026-11-07 12:00:00"), entry("50000", "2026-11-05 12:00:00")];
    response.end(JSON.stringify(entries));
    return;
  }
  if (url.pathname === "/rss") {
    response.setHeader("Content-Type", "application/rss+xml");
    response.end(`<rss><channel><item><title>Junior Coringa: matéria ${ids[0]}</title><link>http://127.0.0.1:${fixturePort}/camara/membros/show/14/noticias/1/${ids[0]}</link><pubDate>Wed, 14 Oct 2026 13:23:00 -0400</pubDate></item></channel></rss>`);
    return;
  }
  if (request.url?.startsWith("/news/")) {
    response.writeHead(200, { "Content-Type": "image/png" });
    response.end(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64"));
    return;
  }
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  if (request.url === "/camara/membros/show/14/noticias/1") {
    response.end(ids.map((id) => `<a href="/camara/membros/show/14/noticias/1/${id}"><span>NOTÍCIAS</span><time>14/10/2026 13:23</time>Junior Coringa: matéria ${id}<div style="background-image:url(/news/${id}.png)"></div></a>`).join("\n"));
    return;
  }
  response.end(`<a class="noticia_imagem"><img src="/news/capa.png"></a><p>${article}</p><div class="botao_avisos">Compartilhar</div>`);
});

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return server.address().port;
}
const fixturePort = await listen(fixture);
const portProbe = createServer();
const appPort = await listen(portProbe);
await new Promise((resolve) => portProbe.close(resolve));
const origin = `http://127.0.0.1:${appPort}`;
const email = "news-check@example.test";
const password = randomBytes(24).toString("hex");
const serverArgs = standalone ? [".next/standalone/server.js"] : ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(appPort)];
const child = spawn(process.execPath, serverArgs, {
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    PORT: String(appPort),
    HOSTNAME: "127.0.0.1",
    DATA_DIR: taskData,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    ADMIN_PASSWORD_HASH: "",
    SESSION_SECRET: randomBytes(32).toString("hex"),
    CAMARA_API_TOKEN: live ? "" : "fixture-key",
    CAMARA_API_URL: `http://127.0.0.1:${fixturePort}/api`,
    CAMARA_RSS_URL: live ? "https://www.camara.ms.gov.br/jsonweb/web-rss.php" : `http://127.0.0.1:${fixturePort}/rss`,
    CAMARA_NEWS_RECOVERY_DIR: recoveryOnly ? path.resolve(standalone ? ".next/standalone/seed/camara-news-recovery" : "seed/camara-news-recovery") : path.join(taskData, "no-recovery"),
    CAMARA_MEMBER_NEWS_URL: live
      ? "https://www.camara.ms.gov.br/camara/membros/show/14/noticias/1"
      : `http://127.0.0.1:${fixturePort}/camara/membros/show/14/noticias/1`,
    CAMARA_MEMBER_ID: "14",
    // Also tests the formerly broken underscore notation.
    CAMARA_NEWS_REQUEST_TIMEOUT_MS: "8_000",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
let logs = "";
child.stdout.on("data", (chunk) => { logs = (logs + chunk).slice(-18000); });
child.stderr.on("data", (chunk) => { logs = (logs + chunk).slice(-18000); });
let database;
try {
  const start = Date.now();
  for (;;) {
    try {
      if ((await fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })).ok) break;
    } catch { /* Wait for this isolated Next server. */ }
    if (Date.now() - start > 30000 || child.exitCode !== null) throw new Error(`Next did not start. ${logs}`);
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const login = await fetch(`${origin}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200, await login.text());
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie);
  async function synchronize(body, expectedStatus = 200) {
    const response = await fetch(`${origin}/api/admin/camara/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, Cookie: cookie },
      body: JSON.stringify({ mode: "news", ...body }),
      signal: AbortSignal.timeout(28000),
    });
    const text = await response.text();
    assert.match(response.headers.get("content-type") || "", /json/);
    assert.equal(response.status, expectedStatus, text);
    return JSON.parse(text);
  }
  const started = Date.now();
  async function discover(scope = "history", resetHistory = false) {
    let { result } = await synchronize({ phase: "discover", scope, resetHistory });
    const firstSources = result.newsSources;
    let pages = 1;
    while (result.newsNextApiPage) {
      assert.ok(pages < 200);
      ({ result } = await synchronize({ phase: "discover", scope, apiPage: result.newsNextApiPage, previousApiPageKey: result.newsApiPageKey }));
      pages += 1;
    }
    return { ...result, firstSources, pages };
  }
  const discovered = await discover();
  console.log(JSON.stringify({ phase: "discovery", live, found: discovered.newsFound, queued: discovered.newsQueueIds.length, milliseconds: Date.now() - started }));
  if (blockedArchive && !recoveryOnly) {
    assert.equal(discovered.pages, 3);
    assert.equal(discovered.newsHistoryComplete, true);
    assert.ok(discovered.firstSources.some((entry) => entry.source === "archive" && entry.status === "unavailable"));
  }
  if (recoveryOnly) assert.ok(discovered.firstSources.some((entry) => entry.source === "recovery" && entry.found === 25));
  for (const id of ids) assert.ok(discovered.newsQueueIds.includes(`camara-news:${id}`), `Missing official article ${id}`);
  const selectedIds = exportRecovery || recoveryOnly ? discovered.newsQueueIds.map((id) => id.replace("camara-news:", "")) : ids;
  for (const id of selectedIds) {
    const began = Date.now();
    const { result } = await synchronize({ phase: "enrich", sourceId: `camara-news:${id}` });
    assert.equal(result.newsInserted, 1, JSON.stringify(result.newsErrors));
    console.log(JSON.stringify({ phase: "article", id, inserted: result.newsInserted, milliseconds: Date.now() - began }));
  }
  database = new Database(path.join(taskData, "junior-coringa.sqlite"), { readonly: true });
  let expectedPosts = selectedIds.length;
  const posts = database.prepare("SELECT * FROM posts").all();
  assert.equal(posts.length, selectedIds.length);
  for (const post of posts) {
    assert.ok(post.content.length > 150);
    assert.ok(post.cover_image?.startsWith("/media/"));
    if (live) assert.notEqual(post.cover_image, "/media/camara-f6b218f19d42e99c259ad268.jpg", "A capa não pode ser o logotipo genérico da Câmara.");
    const page = await fetch(`${origin}/noticias/${post.slug}`);
    assert.equal(page.status, 200);
    const image = await fetch(`${origin}${post.cover_image}`);
    assert.equal(image.status, 200);
  }
  const again = await discover();
  for (const id of ids) assert.ok(!again.newsQueueIds.includes(`camara-news:${id}`), `Completed article queued again: ${id}`);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM posts").get().total, selectedIds.length);
  if (!live && !recoveryOnly) {
    apiRequests.length = 0;
    const completedHistory = await discover("history");
    assert.deepEqual(apiRequests, [], "Um histórico já concluído não é percorrido novamente");
    assert.equal(completedHistory.newsProgress.historyComplete, true);

    apiRequests.length = 0;
    const updates = await discover("updates");
    assert.deepEqual(apiRequests, [1, 2], "A busca recente para antes da página final do arquivo antigo");
    assert.equal(updates.newsQueueIds.length, 0);
    latestItemEnabled = true;
    const fresh = await discover("updates");
    assert.deepEqual(fresh.newsQueueIds, ["camara-news:50000"]);
    const { result: imported } = await synchronize({ phase: "enrich", sourceId: "camara-news:50000" });
    assert.equal(imported.newsInserted, 1);
    expectedPosts += 1;
    apiRequests.length = 0;
    const upToDate = await discover("updates");
    assert.deepEqual(apiRequests, [1], "Depois de atualizar, uma consulta não volta à página histórica seguinte");
    assert.equal(upToDate.newsQueueIds.length, 0);

    interruptUpdate = true;
    const interrupted = await discover("updates");
    assert.equal(interrupted.newsHistoryComplete, false);
    assert.equal(interrupted.newsProgress.watermark, upToDate.newsProgress.watermark, "Falha de página não avança o ponto de corte");
    assert.ok(interrupted.newsQueueIds.includes("camara-news:50001"), "A matéria encontrada antes da falha permanece na fila");
    interruptUpdate = false;
    apiRequests.length = 0;
    await synchronize({ phase: "discover", scope: "history", resetHistory: true });
    const { result: resumed } = await synchronize({ phase: "discover", scope: "history" });
    assert.deepEqual(apiRequests, [1, 2], "A recuperação antiga retoma a próxima página em vez de voltar ao início");
    assert.equal(resumed.newsProgress.nextHistoryPage, 3);
    assert.equal(resumed.newsProgress.watermark, upToDate.newsProgress.watermark);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM posts").get().total, expectedPosts);
    console.log("PASS: completed history is not rescanned; updates fetch only new items; failed pages preserve the watermark and queue.");
  }
  if (exportRecovery) {
    const directory = path.resolve("seed/camara-news-recovery");
    mkdirSync(path.join(directory, "uploads"), { recursive: true });
    const articles = posts.map((post) => {
      const coverFile = path.basename(post.cover_image);
      copyFileSync(path.join(taskData, "uploads", coverFile), path.join(directory, "uploads", coverFile));
      const candidate = database.prepare("SELECT image_url FROM official_news_queue WHERE source_id = ?").get(post.source_id);
      return { sourceId: post.source_id, sourceUrl: post.source_url, title: post.title, excerpt: post.excerpt, content: post.content,
        imageUrl: candidate?.image_url || null, publishedAt: post.published_at, coverFile };
    });
    writeFileSync(path.join(directory, "archive.json"), JSON.stringify({ retrievedAt: new Date().toISOString(),
      sourceUrl: "https://www.camara.ms.gov.br/camara/membros/show/14/noticias/1", articles }, null, 2) + "\n");
    console.log(JSON.stringify({ exportedRecoveryArticles: articles.length, directory }));
  }
  if (!live) {
    archiveUnavailable = true;
    const failed = await synchronize({ phase: "discover" });
    assert.equal(failed.result.newsHistoryComplete, false);
    assert.ok(failed.result.newsSources.some((entry) => entry.status === "unavailable" && /Bot Verification/.test(entry.message)));
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM posts").get().total, expectedPosts);
  }
  console.log("PASS: authenticated HTTP import, full text, saved images, public pages, no duplicates, resumable queue" + (live ? " (real Câmara)." : `, blocked archive=${blockedArchive}, offline recovery=${recoveryOnly}.`));
} catch (error) {
  console.error(error);
  console.error(logs);
  process.exitCode = 1;
} finally {
  database?.close();
  const ended = new Promise((resolve) => child.once("exit", resolve));
  if (child.exitCode === null) {
    child.kill();
    await ended;
  }
  fixture.closeAllConnections();
  await new Promise((resolve) => fixture.close(resolve));
  rmSync(taskData, { recursive: true, force: true });
}
