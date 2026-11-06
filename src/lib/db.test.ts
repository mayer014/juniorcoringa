import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import type { LegislativeItemInput } from "./types";

test("mantém overrides manuais e controla publicação pelo enriquecimento", async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "junior-coringa-db-test-"));
  process.env.DATA_DIR = dataDir;
  const database = await import("./db");

  const base: LegislativeItemInput = {
    externalId: "test-indication:1",
    kind: "indication",
    type: "Indicação",
    number: "123",
    year: 2026,
    title: "Patrolamento no bairro Jardim Teste",
    summary: "Patrolamento de via.",
    publicSummary: "Solicitação de patrolamento no bairro Jardim Teste.",
    author: "Junior Coringa",
    status: "Protocolada",
    statusGroup: "protocolled",
    sourceUrl: "https://example.test/documento/1",
    location: null,
    neighborhood: "Jardim Teste",
    service: "Patrolamento de via",
    reference: null,
    fullText: "Documento oficial",
    lawNumber: null,
    lawDate: null,
    lawUrl: null,
    authorRole: "Autor principal",
    occurredAt: "2026-10-29T12:00:00-04:00",
    enrichmentStatus: "complete",
    enrichmentError: null,
  };

  assert.equal(database.upsertLegislativeItem(base), "inserted");
  const inserted = database.getLegislativeItemByExternalId(base.externalId);
  assert.ok(inserted?.published);

  const reviewed = database.updateLegislativeReview(inserted!.id, {
    title: "Título revisado manualmente",
    publicSummary: "Descrição revisada manualmente.",
    service: "Serviço revisado",
    location: "Rua Revisada, 10",
    neighborhood: "Bairro Revisado",
    reference: null,
    enrichmentStatus: "complete",
  });
  assert.equal(reviewed?.title, "Título revisado manualmente");

  assert.equal(database.upsertLegislativeItem({ ...base, title: "Título novo da fonte" }), "updated");
  const afterSync = database.getLegislativeItemByExternalId(base.externalId);
  assert.equal(afterSync?.title, "Título revisado manualmente");
  assert.equal(afterSync?.neighborhood, "Bairro Revisado");

  assert.equal(database.upsertLegislativeItem({
    ...base,
    externalId: "test-indication:2",
    title: "Operação tapa-buracos",
    neighborhood: null,
    fullText: null,
    enrichmentStatus: "pending",
    initialPublished: false,
  }), "inserted");
  const pending = database.getLegislativeItemByExternalId("test-indication:2");
  assert.equal(pending?.published, false);
  assert.equal(pending?.enrichmentStatus, "pending");

  const project: LegislativeItemInput = {
    ...base,
    externalId: "test-project:1",
    kind: "project",
    type: "Projeto de Lei",
    title: "Projeto relevante",
    summary: "Projeto relevante para a cidade.",
    publicSummary: "Projeto relevante para a cidade.",
    status: "Em tramitação",
    statusGroup: "processing",
    neighborhood: null,
    service: null,
    fullText: null,
    enrichmentStatus: "not_applicable",
  };
  assert.equal(database.upsertLegislativeItem(project), "inserted");
  const storedProject = database.getLegislativeItemByExternalId(project.externalId)!;
  assert.equal(database.updateLegislativeFeatured(storedProject.id, true)?.featured, true);
  assert.equal(database.upsertLegislativeItem({ ...project, status: "Comissão de Justiça" }), "updated");
  assert.equal(database.getLegislativeItemByExternalId(project.externalId)?.featured, true);
  assert.equal(database.listLegislativeItems({ limit: 1 })[0]?.externalId, project.externalId);
  assert.equal(database.updateLegislativeFeatured(inserted!.id, true)?.featured, true);

  const news = {
    sourceId: "camara-news:40257",
    sourceUrl: "https://www.camara.ms.gov.br/camara/membros/show/14/noticias/1/40257",
    title: "Instalação de postes nas Moreninhas",
    excerpt: null,
    imageUrl: null,
    publishedAt: "2026-10-14T13:23:00-04:00",
  };
  assert.equal(database.upsertOfficialNewsCandidate(news), "inserted");
  assert.equal(database.getOfficialNewsQueueCounts().pending, 1);
  database.markOfficialNewsCandidateFailed(news.sourceId, "Imagem temporariamente indisponível");
  const failedNews = database.listOfficialNewsCandidatesForEnrichment();
  assert.equal(failedNews[0]?.status, "failed");
  assert.equal(failedNews[0]?.attempts, 1);
  const recentNews = {
    ...news,
    sourceId: "camara-news:40485",
    sourceUrl: "https://www.camara.ms.gov.br/imprensa/noticias/Noticias/1/2026/40485",
    title: "Homenagem ao árbitro Ivan Bahia",
    publishedAt: "2026-11-05T13:20:47-04:00",
  };
  database.upsertOfficialNewsCandidate(recentNews);
  const recentCutoff = "2026-10-30T12:00:00-04:00";
  assert.deepEqual(
    database.listOfficialNewsCandidatesForEnrichment(50, undefined, recentCutoff).map((item) => item.sourceId),
    [recentNews.sourceId],
    "A fila recente não deve incluir pendências antigas",
  );
  assert.equal(database.getOfficialNewsQueueCounts(recentCutoff).pending, 1);
  assert.equal(database.listOfficialNewsCandidatesForEnrichment().length, 2, "A recuperação histórica mantém toda a fila");
  database.db.prepare("DELETE FROM official_news_queue WHERE source_id = ?").run(recentNews.sourceId);
  database.markOfficialNewsCandidateComplete(news.sourceId);
  assert.equal(database.getOfficialNewsQueueCounts().complete, 1);

  // An old import marked a link-only article as complete. Discovery must repair that queue state.
  database.upsertOfficialNewsCandidate(news);
  assert.equal(database.getOfficialNewsQueueCounts().pending, 1);
  assert.throws(() => database.createOfficialNewsPost({ ...news, content: "[Leia a matéria completa](https://camara.test/40257)", coverImage: null }), /texto completo/);
  const fullContent = "O vereador acompanhou os trabalhos de instalação de postes para ampliar a iluminação pública na região das Moreninhas e ouviu as demandas dos moradores.";
  const fullNews = { ...news, excerpt: "Iluminação pública nas Moreninhas.", content: fullContent, coverImage: "/media/postes.png" };
  assert.equal(database.createOfficialNewsPost(fullNews), "inserted");
  database.upsertOfficialNewsCandidate(news);
  assert.equal(database.getOfficialNewsQueueCounts().complete, 1);

  assert.equal(database.getNewsSyncProgress().watermark, null);
  database.recordNewsDiscoveryPage({ scope: "updates", page: 1, latestDate: "2026-11-05T12:00:00Z", complete: false });
  assert.equal(database.getNewsSyncProgress().watermark, null, "Uma consulta interrompida não avança o ponto de corte");
  database.recordNewsDiscoveryPage({ scope: "updates", page: 2, latestDate: "2026-11-01T12:00:00Z", complete: true });
  assert.equal(database.getNewsSyncProgress().watermark, "2026-11-05T12:00:00Z");
  database.recordNewsDiscoveryPage({ scope: "history", page: 166, latestDate: "2020-01-01T12:00:00Z", complete: false });
  assert.equal(database.getNewsSyncProgress().nextHistoryPage, 167);
  database.resetNewsHistoryProgress();
  assert.equal(database.getNewsSyncProgress().nextHistoryPage, 1);
  assert.equal(database.getNewsSyncProgress().watermark, "2026-11-05T12:00:00Z", "Revisar histórico não apaga o progresso das novidades");

  // A different official URL for the same code must not duplicate or erase the text.
  assert.equal(database.createOfficialNewsPost({ ...fullNews, sourceUrl: "https://www.camara.ms.gov.br/imprensa/noticias/Noticias/1/2026/40257", content: "[Leia a matéria completa](https://camara.test/40257)", excerpt: "Resumo genérico.", coverImage: null }), "unchanged");
  const storedNews = database.db.prepare("SELECT content FROM posts WHERE source_id = ?").get(news.sourceId) as { content: string };
  assert.equal(storedNews.content, fullContent);
  assert.equal(database.listAllPosts().filter((post) => post.title === news.title).length, 1);
  database.db.prepare("UPDATE posts SET cover_image = ? WHERE source_id = ?")
    .run("/media/camara-f6b218f19d42e99c259ad268.jpg", news.sourceId);
  database.upsertOfficialNewsCandidate(news);
  assert.equal(database.listOfficialNewsCandidatesForEnrichment(1, news.sourceId)[0]?.status, "pending");
  assert.equal(database.createOfficialNewsPost(fullNews), "updated");
  database.upsertOfficialNewsCandidate(news);
  assert.equal(database.getOfficialNewsQueueCounts().complete, 1);

  database.db.close();
  rmSync(dataDir, { recursive: true, force: true });
});
