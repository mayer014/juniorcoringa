import "server-only";

import { XMLParser } from "fast-xml-parser";
import * as he from "he";
import { PDFParse } from "pdf-parse";
import {
  createOfficialNewsPost,
  finishCamaraSyncRun,
  getLegislativeItemByExternalId,
  isCamaraSyncRunning,
  startCamaraSyncRun,
  upsertLegislativeItem,
} from "@/lib/db";
import type { LegislativeItemInput, LegislativeStatusGroup } from "@/lib/types";

const LEGIS_BASE_URL = "https://legis.camara.ms.gov.br";
const CAMARA_RSS_URL = "https://www.camara.ms.gov.br/jsonweb/web-rss.php";
const VEREADOR_NAME = "Junior Coringa";
const FIRST_IMPORT_YEAR = 2024;
const REQUEST_TIMEOUT_MS = 90_000;
const PAGE_SIZE = 100;
const PDF_DETAILS_PER_RUN = Number.parseInt(process.env.CAMARA_PDF_DETAILS_LIMIT ?? "50", 10);

type DataTableResponse = {
  data?: unknown[][];
  recordsTotal?: number | string;
  recordsFiltered?: number | string;
  error?: string;
};

type IndicationDetails = {
  location: string | null;
  neighborhood: string | null;
  service: string;
  fullText: string | null;
  title: string;
};

export type CamaraSyncResult = {
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  newsInserted: number;
  projects: number;
  indications: number;
  pdfDetails: number;
};

function normalizeText(value: unknown) {
  return he.decode(String(value ?? ""))
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/[_\s]+/g, " ")
    .trim();
}

function normalizeForComparison(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function containsJunior(value: unknown) {
  return normalizeForComparison(normalizeText(value)).includes("junior coringa");
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

function sentenceCase(value: string) {
  const clean = normalizeText(value).replace(/\s+([,.;:])/g, "$1");
  if (!clean) return clean;
  const letters = clean.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const uppercase = letters.replace(/[^A-ZÀ-Þ]/g, "");
  if (letters.length && uppercase.length / letters.length > 0.75) {
    return clean.toLocaleLowerCase("pt-BR").replace(/(^|[.!?]\s+)(\p{L})/gu, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase("pt-BR")}`);
  }
  return clean.charAt(0).toLocaleUpperCase("pt-BR") + clean.slice(1);
}

function concise(value: string, maximum = 150) {
  if (value.length <= maximum) return value;
  const shortened = value.slice(0, maximum + 1).replace(/\s+\S*$/, "").trim();
  return `${shortened}…`;
}

function normalizeProjectStatus(status: string): LegislativeStatusGroup {
  const normalized = normalizeForComparison(status);
  if (/arquivad|rejeitad|retirad|prejudicad|vetado totalmente/.test(normalized)) return "archived";
  if (/sancionad|promulgad|aprovad|publicad|convertid|lei\s+n/.test(normalized)) return "approved";
  return "processing";
}

async function fetchWithRetry(url: string | URL, init: RequestInit, context: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (response.ok || response.status < 500) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
  }
  const reason = lastError instanceof Error ? lastError.message : "erro desconhecido";
  throw new Error(`${context} falhou após 3 tentativas: ${reason}`);
}

async function fetchDataTable(url: URL) {
  const response = await fetchWithRetry(url, {
    headers: {
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer: `${LEGIS_BASE_URL}/`,
      "X-Requested-With": "XMLHttpRequest",
      "User-Agent": "JuniorCoringaMandato/1.0 (+https://juniorcoringa.com.br)",
    },
    cache: "no-store",
  }, `Consulta ${url.searchParams.get("categoria")}/${url.searchParams.get("ano_filter")}`);
  if (!response.ok) throw new Error(`Portal legislativo respondeu HTTP ${response.status}.`);
  const json = await response.json() as DataTableResponse;
  if (json.error) throw new Error(`Portal legislativo: ${json.error}`);
  return json;
}

async function fetchLegislativeRows(endpoint: "Ato" | "Documento", category: "projeto" | "documento", year: number) {
  const rows: unknown[][] = [];
  let expected = Number.POSITIVE_INFINITY;
  for (let start = 0, draw = 1; start < expected; start += PAGE_SIZE, draw += 1) {
    const url = new URL(`${LEGIS_BASE_URL}/src/App/Ajax/${endpoint}/listar_publico.php`);
    url.searchParams.set("categoria", category);
    url.searchParams.set("captcha", "");
    url.searchParams.set("busca", "");
    url.searchParams.set("nome_vereadores", VEREADOR_NAME);
    url.searchParams.set("ano_filter", String(year));
    url.searchParams.set("draw", String(draw));
    url.searchParams.set("start", String(start));
    url.searchParams.set("length", String(PAGE_SIZE));
    const page = await fetchDataTable(url);
    const pageRows = Array.isArray(page.data) ? page.data : [];
    expected = Number(page.recordsFiltered ?? page.recordsTotal ?? pageRows.length);
    rows.push(...pageRows);
    if (!pageRows.length || pageRows.length < PAGE_SIZE) break;
  }
  if (Number.isFinite(expected) && rows.length < expected) {
    throw new Error(`Consulta incompleta de ${category}/${year}: recebidos ${rows.length} de ${expected} registros.`);
  }
  return rows;
}

function parseLaw(detailHtml: unknown) {
  const html = String(detailHtml ?? "");
  const link = html.match(/href=["']([^"']*\/ato\/consolidado\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
  if (!link) return { lawNumber: null, lawDate: null, lawUrl: null };
  const label = normalizeText(link[2]);
  const number = label.match(/((?:Lei|Decreto)[^\d]{0,30}\d+[./]\d{4})/i)?.[1] ?? label.replace(/\s+de\s+\d{2}\/\d{2}\/\d{4}.*/, "");
  const date = label.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1] ?? null;
  return { lawNumber: normalizeText(number) || null, lawDate: date, lawUrl: he.decode(link[1]) };
}

function projectFromRow(row: unknown[]): LegislativeItemInput | null {
  const detailHtml = row[0];
  const author = normalizeText(row[8]) || getDefinitionValue(detailHtml, "Parlamentar Responsável/Autor");
  if (!containsJunior(author) && !containsJunior(detailHtml)) return null;
  const sourceUrl = getAttribute(row[6], "href") || LEGIS_BASE_URL;
  const atoId = sourceUrl.match(/\/conteudo\/(\d+)/)?.[1] || getAttribute(detailHtml, "data-ato-id");
  const number = normalizeText(row[1]) || getDefinitionValue(detailHtml, "Número");
  const year = Number.parseInt(normalizeText(row[2]), 10);
  const date = normalizeText(row[3]) || getDefinitionValue(detailHtml, "Data");
  const status = normalizeText(row[4]) || getDefinitionValue(detailHtml, "Situação") || "Em tramitação";
  const summary = sentenceCase(normalizeText(row[5]) || getDefinitionValue(detailHtml, "Ementa"));
  const type = getDefinitionValue(detailHtml, "Tipo") || "Projeto legislativo";
  const law = parseLaw(detailHtml);
  if (!number || !Number.isFinite(year) || !summary) return null;
  return {
    externalId: `camara-project:${atoId || `${type}:${number}:${year}`}`,
    kind: "project",
    type,
    number,
    year,
    title: concise(summary),
    summary,
    author: author || VEREADOR_NAME,
    status,
    statusGroup: normalizeProjectStatus(status),
    sourceUrl,
    location: null,
    neighborhood: null,
    service: null,
    fullText: null,
    lawNumber: law.lawNumber,
    lawDate: law.lawDate,
    lawUrl: law.lawUrl,
    authorRole: containsJunior(author) ? "Autor principal" : "Coautor ou signatário",
    occurredAt: parseBrazilianDate(date),
    rawJson: JSON.stringify(row),
  };
}

function cleanPdfText(value: string) {
  return value
    .replace(/Página \d+\/\d+\s*/gi, "")
    .replace(/-- \d+ of \d+ --/gi, "")
    .replace(/Câmara Municipal de Campo Grande\s+ESTADO DE MATO GROSSO DO SUL\s+Avenida Ricardo Brandão, 1600\.\s+CNPJ:[^\n]+\s*/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractNeighborhood(text: string) {
  const patterns = [
    /Bairro:\s*([^,\n]+?)(?:,\s*Campo|,\s*CEP|\n|$)/i,
    /BAIRRO\s+([A-ZÀ-Ý0-9 .'-]+?)(?:,\s*CEP|\s+CEP|,\s*EM CAMPO|,\s*CAMPO|\n)/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern)?.[1];
    if (match) return sentenceCase(match);
  }
  return null;
}

function extractLocation(text: string) {
  const section = text.match(/(?:4\D{0,4})?ENDEREÇO\s+([\s\S]*?)(?:Endereço completo:|Junior Coringa|$)/i)?.[1];
  if (section) {
    const cleaned = normalizeText(section)
      .replace(/^completo:\s*/i, "")
      .replace(/,?\s*Complemento:\s*$/i, "")
      .replace(/\s*CEP Busca\s*$/i, "")
      .replace(/[.]$/, "");
    if (cleaned) return cleaned;
  }
  const request = text.match(/((?:RUA|AVENIDA|ALAMEDA|TRAVESSA|ESTRADA|PRAÇA|RODOVIA)\s+[A-ZÀ-Ý0-9 .,'º°-]+?)(?:,\s*(?:ESPECIALMENTE|BAIRRO|CEP|EM CAMPO)|\s+BAIRRO|\n)/)?.[1];
  return request ? sentenceCase(request) : null;
}

function buildIndicationDetails(summaryValue: string, pdfText: string | null): IndicationDetails {
  const summary = sentenceCase(summaryValue).replace(/[.]$/, "");
  const fullText = pdfText ? cleanPdfText(pdfText) : null;
  const location = fullText ? extractLocation(fullText) : extractLocation(summary);
  const neighborhood = fullText ? extractNeighborhood(fullText) : extractNeighborhood(summary);
  const service = summary || "Solicitação de melhoria urbana";
  const primaryLocation = location?.split(/,\s*(?:proximidades|bairro|cep|campo grande)/i)[0]?.trim() ?? null;
  const locationAlreadyPresent = primaryLocation && normalizeForComparison(service).includes(normalizeForComparison(primaryLocation));
  const title = concise(locationAlreadyPresent || !primaryLocation ? service : `${service} — ${primaryLocation}`, 165);
  return { location, neighborhood, service, fullText, title };
}

async function fetchPdfText(sourceUrl: string) {
  const response = await fetchWithRetry(sourceUrl, {
    headers: { "User-Agent": "JuniorCoringaMandato/1.0 (+https://juniorcoringa.com.br)" },
    cache: "no-store",
  }, `PDF ${sourceUrl}`);
  if (!response.ok) throw new Error(`PDF respondeu HTTP ${response.status}.`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) throw new Error("Documento oficial não retornou um PDF.");
  const parser = new PDFParse({ data: new Uint8Array(await response.arrayBuffer()) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function indicationFromRow(row: unknown[], loadPdf: boolean): Promise<{ item: LegislativeItemInput | null; pdfLoaded: boolean }> {
  const detailHtml = row[0];
  const author = normalizeText(row[4]) || getDefinitionValue(detailHtml, "Autor");
  const type = getDefinitionValue(detailHtml, "Tipo") || "Indicação";
  if (!containsJunior(author) || normalizeForComparison(type) !== "indicacao") return { item: null, pdfLoaded: false };
  const documentId = normalizeText(row[7]);
  const number = normalizeText(row[1]) || getDefinitionValue(detailHtml, "Número");
  const year = Number.parseInt(normalizeText(row[2]), 10);
  const date = normalizeText(row[3]) || getDefinitionValue(detailHtml, "Data");
  const summary = normalizeText(row[5]) || getDefinitionValue(detailHtml, "Assunto");
  const sourceUrl = getAttribute(row[6], "href") || LEGIS_BASE_URL;
  if (!documentId || !number || !Number.isFinite(year) || !summary) return { item: null, pdfLoaded: false };
  const externalId = `camara-indication:${documentId}`;
  const existing = getLegislativeItemByExternalId(externalId);
  let pdfText = existing?.fullText ?? null;
  let pdfLoaded = false;
  if (!pdfText && loadPdf && sourceUrl !== LEGIS_BASE_URL) {
    try {
      pdfText = await fetchPdfText(sourceUrl);
      pdfLoaded = true;
    } catch (error) {
      console.warn(`Não foi possível detalhar a indicação ${number}/${year}:`, error);
    }
  }
  const details = buildIndicationDetails(summary, pdfText);
  return {
    pdfLoaded,
    item: {
      externalId,
      kind: "indication",
      type: "Indicação",
      number,
      year,
      title: details.title,
      summary: sentenceCase(summary),
      author: author || VEREADOR_NAME,
      status: "Protocolada",
      statusGroup: "protocolled",
      sourceUrl,
      location: details.location,
      neighborhood: details.neighborhood,
      service: details.service,
      fullText: details.fullText,
      lawNumber: null,
      lawDate: null,
      lawUrl: null,
      authorRole: "Autor principal",
      occurredAt: parseBrazilianDate(date),
      rawJson: JSON.stringify(row),
    },
  };
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, mapper: (value: T, index: number) => Promise<R>) {
  const result = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return result;
}

async function fetchOfficialNews() {
  const response = await fetchWithRetry(CAMARA_RSS_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    cache: "no-store",
  }, "RSS da Câmara");
  if (!response.ok) throw new Error(`RSS da Câmara respondeu HTTP ${response.status}.`);
  const xml = await response.text();
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml) as { rss?: { channel?: { item?: unknown | unknown[] } } };
  const rawItems = parsed.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  return items.flatMap((raw) => {
    const item = raw as { title?: string; description?: string; link?: string; guid?: string; pubDate?: string };
    if (!containsJunior(`${item.title ?? ""} ${item.description ?? ""}`)) return [];
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
    const years = Array.from({ length: currentYear - FIRST_IMPORT_YEAR + 1 }, (_, index) => currentYear - index);
    const [projectPages, indicationPages, news] = await Promise.all([
      Promise.all(years.map((year) => fetchLegislativeRows("Ato", "projeto", year))),
      Promise.all(years.map((year) => fetchLegislativeRows("Documento", "documento", year))),
      fetchOfficialNews(),
    ]);
    const projects = projectPages.flat().map(projectFromRow).filter((item): item is LegislativeItemInput => Boolean(item));
    const indicationRows = indicationPages.flat().sort((a, b) => parseBrazilianDate(b[3]).localeCompare(parseBrazilianDate(a[3])));
    let remainingPdfDetails = Number.isFinite(PDF_DETAILS_PER_RUN) ? Math.max(PDF_DETAILS_PER_RUN, 0) : 50;
    const parsedIndications = await mapWithConcurrency(indicationRows, 4, async (row) => {
      const documentId = normalizeText(row[7]);
      const existing = documentId ? getLegislativeItemByExternalId(`camara-indication:${documentId}`) : null;
      const isIndication = normalizeForComparison(getDefinitionValue(row[0], "Tipo")) === "indicacao";
      const loadPdf = isIndication && !existing?.fullText && remainingPdfDetails > 0;
      if (loadPdf) remainingPdfDetails -= 1;
      return indicationFromRow(row, loadPdf);
    });
    const indications = parsedIndications.map((entry) => entry.item).filter((item): item is LegislativeItemInput => Boolean(item));
    const items = [...projects, ...indications];
    const counts = { inserted: 0, updated: 0, unchanged: 0 };
    for (const item of items) counts[upsertLegislativeItem(item)] += 1;
    let newsInserted = 0;
    for (const item of news) if (createOfficialNewsPost(item)) newsInserted += 1;
    const result: CamaraSyncResult = {
      found: items.length,
      inserted: counts.inserted,
      updated: counts.updated,
      unchanged: counts.unchanged,
      newsInserted,
      projects: projects.length,
      indications: indications.length,
      pdfDetails: parsedIndications.filter((entry) => entry.pdfLoaded).length,
    };
    finishCamaraSyncRun(runId, { status: "success", ...result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido na sincronização.";
    finishCamaraSyncRun(runId, { status: "error", error: message.slice(0, 1000) });
    throw error;
  }
}
