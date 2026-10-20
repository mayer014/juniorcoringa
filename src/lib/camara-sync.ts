import "server-only";

import { XMLParser } from "fast-xml-parser";
import * as he from "he";
import { after } from "next/server";
import {
  createOfficialNewsPost,
  finishCamaraSyncRun,
  getLatestCamaraSyncRun,
  isCamaraSyncRunning,
  startCamaraSyncRun,
  upsertLegislativeItem,
} from "@/lib/db";
import type { LegislativeItemInput, LegislativeStatusGroup } from "@/lib/types";

const LEGIS_BASE_URL = "https://legis.camara.ms.gov.br";
const CAMARA_RSS_URL = "https://www.camara.ms.gov.br/jsonweb/web-rss.php";
const VEREADOR_NAME = "Junior Coringa";
const REQUEST_TIMEOUT_MS = 45_000;
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;

type DataTableResponse = {
  data?: unknown[][];
  error?: string;
};

export type CamaraSyncResult = {
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  newsInserted: number;
};

function normalizeText(value: unknown) {
  return he.decode(String(value ?? ""))
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForComparison(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function containsJunior(value: unknown) {
  const normalized = normalizeForComparison(normalizeText(value));
  return normalized.includes("junior coringa") || normalized.includes("junior  coringa");
}

function parseBrazilianDate(value: unknown) {
  const match = String(value ?? "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return new Date().toISOString();
  return `${match[3]}-${match[2]}-${match[1]}T12:00:00-04:00`;
}

function getAttribute(html: unknown, attribute: string) {
  const escaped = attribute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html ?? "").match(new RegExp(`${escaped}=["']([^"']+)["']`, "i"));
  return match?.[1] ? he.decode(match[1]) : "";
}

function getDefinitionValue(html: unknown, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(html ?? "").match(
    new RegExp(`<dt[^>]*>\\s*${escaped}:?\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`, "i"),
  );
  return normalizeText(match?.[1]);
}

function normalizeProjectStatus(status: string): LegislativeStatusGroup {
  const normalized = normalizeForComparison(status);
  if (/arquivad|rejeitad|retirad|prejudicad/.test(normalized)) return "archived";
  if (/sancionad|promulgad|aprovad|publicad|convertid|lei\s+n/.test(normalized)) return "approved";
  return "processing";
}

async function fetchJson(url: URL) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: `${LEGIS_BASE_URL}/`,
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "JuniorCoringaMandato/1.0 (+https://juniorcoringa.com.br)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Portal legislativo respondeu HTTP ${response.status}.`);
  const json = await response.json() as DataTableResponse;
  if (json.error) throw new Error(`Portal legislativo: ${json.error}`);
  return Array.isArray(json.data) ? json.data : [];
}

async function fetchLegislativeRows(endpoint: "Ato" | "Documento", category: "projeto" | "documento", year: number) {
  const url = new URL(`${LEGIS_BASE_URL}/src/App/Ajax/${endpoint}/listar_publico.php`);
  url.searchParams.set("categoria", category);
  url.searchParams.set("captcha", "");
  url.searchParams.set("busca", VEREADOR_NAME);
  url.searchParams.set("ano_filter", String(year));
  url.searchParams.set("draw", "1");
  url.searchParams.set("start", "0");
  url.searchParams.set("length", "200");
  return fetchJson(url);
}

function projectFromRow(row: unknown[]): LegislativeItemInput | null {
  const detailHtml = row[0];
  const author = normalizeText(row[8]) || getDefinitionValue(detailHtml, "Parlamentar Responsável/Autor");
  if (!containsJunior(author) && !containsJunior(detailHtml)) return null;
  const atoId = getAttribute(detailHtml, "data-ato-id");
  const number = normalizeText(row[1]) || getDefinitionValue(detailHtml, "Número");
  const year = Number.parseInt(normalizeText(row[2]), 10);
  const date = normalizeText(row[3]) || getDefinitionValue(detailHtml, "Data");
  const status = normalizeText(row[4]) || getDefinitionValue(detailHtml, "Situação") || "Em tramitação";
  const summary = normalizeText(row[5]) || getDefinitionValue(detailHtml, "Ementa");
  const type = getDefinitionValue(detailHtml, "Tipo") || "Projeto legislativo";
  const sourceUrl = getAttribute(row[6], "href") || (atoId ? `${LEGIS_BASE_URL}/conteudo/${atoId}` : LEGIS_BASE_URL);
  if (!number || !Number.isFinite(year) || !summary) return null;
  return {
    externalId: `camara-project:${atoId || `${type}:${number}:${year}`}`,
    kind: "project",
    type,
    number,
    year,
    title: `${type} nº ${number}/${year}`,
    summary,
    author: author || VEREADOR_NAME,
    status,
    statusGroup: normalizeProjectStatus(status),
    sourceUrl,
    occurredAt: parseBrazilianDate(date),
    rawJson: JSON.stringify(row),
  };
}

function indicationFromRow(row: unknown[]): LegislativeItemInput | null {
  const detailHtml = row[0];
  const author = normalizeText(row[4]) || getDefinitionValue(detailHtml, "Autor");
  if (!containsJunior(author)) return null;
  const documentId = normalizeText(row[7]);
  const number = normalizeText(row[1]) || getDefinitionValue(detailHtml, "Número");
  const year = Number.parseInt(normalizeText(row[2]), 10);
  const date = normalizeText(row[3]) || getDefinitionValue(detailHtml, "Data");
  const summary = normalizeText(row[5]) || getDefinitionValue(detailHtml, "Assunto");
  const type = getDefinitionValue(detailHtml, "Tipo") || "Indicação";
  const sourceUrl = getAttribute(row[6], "href") || LEGIS_BASE_URL;
  if (!documentId || !number || !Number.isFinite(year) || !summary) return null;
  return {
    externalId: `camara-indication:${documentId}`,
    kind: "indication",
    type,
    number,
    year,
    title: `${type} nº ${number}/${year}`,
    summary,
    author: author || VEREADOR_NAME,
    status: "Protocolada",
    statusGroup: "protocolled",
    sourceUrl,
    occurredAt: parseBrazilianDate(date),
    rawJson: JSON.stringify(row),
  };
}

async function fetchOfficialNews() {
  const response = await fetch(CAMARA_RSS_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`RSS da Câmara respondeu HTTP ${response.status}.`);
  const xml = await response.text();
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml) as {
    rss?: { channel?: { item?: unknown | unknown[] } };
  };
  const rawItems = parsed.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return items.flatMap((raw) => {
    const item = raw as { title?: string; description?: string; link?: string; guid?: string; pubDate?: string };
    const searchable = `${item.title ?? ""} ${item.description ?? ""}`;
    if (!containsJunior(searchable)) return [];
    const sourceUrl = String(item.link ?? item.guid ?? "").trim();
    const title = normalizeText(item.title);
    if (!sourceUrl || !title) return [];
    const description = normalizeText(item.description);
    return [{
      sourceId: `camara-rss:${String(item.guid ?? sourceUrl)}`,
      sourceUrl,
      title,
      excerpt: description || "Notícia publicada pela Câmara Municipal de Campo Grande sobre a atuação do vereador Junior Coringa.",
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    }];
  });
}

export async function syncCamaraData(): Promise<CamaraSyncResult> {
  if (isCamaraSyncRunning()) throw new Error("Já existe uma sincronização da Câmara em andamento.");
  const runId = startCamaraSyncRun();
  try {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];
    const [projectPages, indicationPages, news] = await Promise.all([
      Promise.all(years.map((year) => fetchLegislativeRows("Ato", "projeto", year))),
      Promise.all(years.map((year) => fetchLegislativeRows("Documento", "documento", year))),
      fetchOfficialNews(),
    ]);
    const projectRows = projectPages.flat();
    const indicationRows = indicationPages.flat();
    const items = [
      ...projectRows.map(projectFromRow),
      ...indicationRows.map(indicationFromRow),
    ].filter((item): item is LegislativeItemInput => Boolean(item));
    const counts = { inserted: 0, updated: 0, unchanged: 0 };
    for (const item of items) {
      const result = upsertLegislativeItem(item);
      counts[result] += 1;
    }
    let newsInserted = 0;
    for (const item of news) {
      if (createOfficialNewsPost(item)) newsInserted += 1;
    }
    const result: CamaraSyncResult = {
      found: items.length,
      inserted: counts.inserted,
      updated: counts.updated,
      unchanged: counts.unchanged,
      newsInserted,
    };
    finishCamaraSyncRun(runId, { status: "success", ...result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido na sincronização.";
    finishCamaraSyncRun(runId, { status: "error", error: message.slice(0, 1000) });
    throw error;
  }
}

export function scheduleCamaraSyncIfStale() {
  const latest = getLatestCamaraSyncRun();
  const reference = latest?.finishedAt ?? latest?.startedAt;
  if (latest?.status === "success" && reference && Date.now() - new Date(reference).getTime() < SYNC_INTERVAL_MS) return;
  if (isCamaraSyncRunning()) return;
  after(async () => {
    try {
      await syncCamaraData();
    } catch (error) {
      console.error("Sincronização automática da Câmara falhou:", error);
    }
  });
}
