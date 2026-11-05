// Run after `npm run build`. Uses an isolated database and temporary credentials.
// --live checks the real Câmara archive and the three articles reported missing.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

const live = process.argv.includes("--live");
const taskData = mkdtempSync(path.join(tmpdir(), "junior-camara-http-test-"));
const ids = ["40257", "40215", "39428"];
const article = "O vereador Junior Coringa acompanhou as demandas dos moradores e solicitou melhorias na iluminação pública. A iniciativa atende à comunidade das Moreninhas, com instalação de postes e reforço da segurança nas ruas do bairro.";
let archiveUnavailable = false;
const fixture = createServer((request, response) => {
  if (archiveUnavailable) {
    response.writeHead(502, { "Content-Type": "text/html" });
    response.end("<!DOCTYPE html><h1>Upstream unavailable</h1>");
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
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(appPort)], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    DATA_DIR: taskData,
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD: password,
    ADMIN_PASSWORD_HASH: "",
    SESSION_SECRET: randomBytes(32).toString("hex"),
    CAMARA_API_TOKEN: "",
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
  const { result: discovered } = await synchronize({ phase: "discover" });
  console.log(JSON.stringify({ phase: "discovery", live, found: discovered.newsFound, queued: discovered.newsQueueIds.length, milliseconds: Date.now() - started }));
  for (const id of ids) assert.ok(discovered.newsQueueIds.includes(`camara-news:${id}`), `Missing official article ${id}`);
  for (const id of ids) {
    const began = Date.now();
    const { result } = await synchronize({ phase: "enrich", sourceId: `camara-news:${id}` });
    assert.equal(result.newsInserted, 1, JSON.stringify(result.newsErrors));
    console.log(JSON.stringify({ phase: "article", id, inserted: result.newsInserted, milliseconds: Date.now() - began }));
  }
  database = new Database(path.join(taskData, "junior-coringa.sqlite"), { readonly: true });
  const posts = database.prepare("SELECT slug, content, cover_image FROM posts").all();
  assert.equal(posts.length, ids.length);
  for (const post of posts) {
    assert.ok(post.content.length > 150);
    assert.ok(post.cover_image?.startsWith("/media/"));
    const page = await fetch(`${origin}/noticias/${post.slug}`);
    assert.equal(page.status, 200);
    const image = await fetch(`${origin}${post.cover_image}`);
    assert.equal(image.status, 200);
  }
  const { result: again } = await synchronize({ phase: "discover" });
  for (const id of ids) assert.ok(!again.newsQueueIds.includes(`camara-news:${id}`), `Completed article queued again: ${id}`);
  assert.equal(database.prepare("SELECT COUNT(*) AS total FROM posts").get().total, ids.length);
  if (!live) {
    archiveUnavailable = true;
    const failed = await synchronize({ phase: "discover" }, 503);
    assert.match(failed.error, /HTTP 502/);
    assert.equal(database.prepare("SELECT COUNT(*) AS total FROM posts").get().total, ids.length);
  }
  console.log("PASS: authenticated HTTP import, full text, saved images, public pages, no duplicates, resumable queue" + (live ? " (real Câmara)." : ", JSON on upstream failure."));
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
