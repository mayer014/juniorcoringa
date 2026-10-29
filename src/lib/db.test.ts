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

  database.db.close();
  rmSync(dataDir, { recursive: true, force: true });
});
