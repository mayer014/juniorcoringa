import "server-only";

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser } from "fast-xml-parser";
import * as he from "he";
import TurndownService from "turndown";
import {
  createOfficialNewsPost,
  finishCamaraSyncRun,
  getLegislativeItemByExternalId,
  heartbeatCamaraSyncRun,
  listLegislativeItems,
  startCamaraSyncRun,
  updateLegislativeItemTitle,
  upsertLegislativeItem,
} from "@/lib/db";
import {
  buildIndicationDetails,
  concise,
  normalizeForComparison,
  normalizeLegislativeText,
  sentenceCase,
} from "@/lib/legislative-content";
import type { LegislativeItemInput, LegislativeStatusGroup } from "@/lib/types";

const LEGIS_BASE_URL = "https://legis.camara.ms.gov.br";
const CAMARA_RSS_URL = "https://www.camara.ms.gov.br/jsonweb/web-rss.php";
const CAMARA_API_URL = process.env.CAMARA_API_URL || "https://www.camara.ms.gov.br/jsonweb/web-aplicativo.php";
const CAMARA_API_TOKEN = process.env.CAMARA_API_TOKEN || "";
const CAMARA_NEWS_READER_URL = process.env.CAMARA_NEWS_READER_URL || "https://r.jina.ai/";
const VEREADOR_NAME = "Junior Coringa";
const REQUEST_TIMEOUT_MS = 90_000;
const PAGE_SIZE = 100;
const NEWS_DETAILS_RETRY_DELAYS_MS = [0, 1_500, 4_000] as const;
const PDF_DETAILS_PER_RUN = Number.parseInt(process.env.CAMARA_PDF_DETAILS_LIMIT ?? "50", 10);
const PDF_BACKFILL_PER_RUN = Number.parseInt(process.env.CAMARA_PDF_BACKFILL_LIMIT ?? "250", 10);
const DATA_DIR = path.resolve(
  /* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"),
);

type DataTableResponse = {
  data?: unknown[][];
  recordsTotal?: number | string;
  recordsFiltered?: number | string;
  error?: string;
};

type OfficialPublication = {
  data?: string;
  titulo?: string;
  resumo?: string;
  imagem?: string;
  link?: string;
};

type OfficialNewsItem = {
  sourceId: string;
  sourceUrl: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  publishedAt: string;
};

type OfficialNewsBatch = {
  items: OfficialNewsItem[];
  pending: number;
};

export type CamaraSyncResult = {
  mode: CamaraSyncMode;
  found: number;
  inserted: number;
  updated: number;
  unchanged: number;
  newsInserted: number;
  newsUpdated: number;
  newsPending: number;
  projects: number;
  indications: number;
  pdfDetails: number;
  retitled: number;
  enriched: number;
  pending: number;
  failed: number;
  manualReview: number;
};

export type CamaraSyncMode = "daily" | "history" | "indications";
export type CamaraSyncTrigger = "manual" | "scheduled";

function normalizeText(value: unknown) {
  return normalizeLegislativeText(value);
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

function projectTitle(summary: string) {
  const title = sentenceCase(summary)
    .replace(/^["“”']+|["“”']+$/g, "")
    .replace(/^Dispõe sobre (?:a |o |as |os )?/i, "")
    .replace(/^Estabelece (?:a |o |as |os )?/i, "")
    .replace(/,?\s+(?:no âmbito d[eo]|no|do) município de Campo Grande(?:\s*[-–/]?\s*MS)?(?=,?\s+e dá outras providências|[. ]*$)/i, "")
    .replace(/,?\s+e dá outras providências[. ]*$/i, "")
    .replace(/[.]$/, "")
    .trim();
  return concise(sentenceCase(title), 105);
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

async function fetchLegislativeRows(endpoint: "Ato" | "Documento", category: "projeto" | "documento", year?: number) {
  const rows: unknown[][] = [];
  let expected = Number.POSITIVE_INFINITY;
  for (let start = 0, draw = 1; start < expected; start += PAGE_SIZE, draw += 1) {
    const url = new URL(`${LEGIS_BASE_URL}/src/App/Ajax/${endpoint}/listar_publico.php`);
    url.searchParams.set("categoria", category);
    url.searchParams.set("captcha", "");
    url.searchParams.set("busca", "");
    url.searchParams.set("nome_vereadores", VEREADOR_NAME);
    if (year) url.searchParams.set("ano_filter", String(year));
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
    throw new Error(`Consulta incompleta de ${category}/${year ?? "histórico"}: recebidos ${rows.length} de ${expected} registros.`);
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
    title: projectTitle(summary),
    summary,
    publicSummary: summary,
    author: author || VEREADOR_NAME,
    status,
    statusGroup: law.lawUrl ? "approved" : normalizeProjectStatus(status),
    sourceUrl,
    location: null,
    neighborhood: null,
    service: null,
    reference: null,
    fullText: null,
    lawNumber: law.lawNumber,
    lawDate: law.lawDate,
    lawUrl: law.lawUrl,
    authorRole: containsJunior(author) ? "Autor principal" : "Coautor ou signatário",
    enrichmentStatus: "not_applicable",
    enrichmentError: null,
    occurredAt: parseBrazilianDate(date),
    rawJson: JSON.stringify(row),
  };
}

function retitleStoredIndications() {
  let retitled = 0;
  for (let offset = 0; ; offset += 500) {
    const items = listLegislativeItems({ kind: "indication", limit: 500, offset });
    for (const item of items) {
      const title = buildIndicationDetails(item.summary, item.fullText).title;
      if (updateLegislativeItemTitle(item.id, title)) retitled += 1;
    }
    if (items.length < 500) break;
  }
  return retitled;
}

async function fetchPdfText(sourceUrl: string) {
  const response = await fetchWithRetry(sourceUrl, {
    headers: { "User-Agent": "JuniorCoringaMandato/1.0 (+https://juniorcoringa.com.br)" },
    cache: "no-store",
  }, `PDF ${sourceUrl}`);
  if (!response.ok) throw new Error(`PDF respondeu HTTP ${response.status}.`);
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) throw new Error("Documento oficial não retornou um PDF.");
  return parsePdfText(new Uint8Array(await response.arrayBuffer()));
}

async function parsePdfText(data: Uint8Array, parameters?: { lineThreshold?: number; pageJoiner?: string }) {
  // Carregamento tardio: uma incompatibilidade opcional do leitor de PDF nunca pode
  // impedir a importação da listagem oficial e deixar toda a página vazia.
  await import("@napi-rs/canvas");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText(parameters);
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
  let enrichmentAttempted = false;
  let enrichmentError: string | null = existing?.enrichmentError ?? null;
  if (!pdfText && loadPdf && sourceUrl !== LEGIS_BASE_URL) {
    enrichmentAttempted = true;
    try {
      pdfText = await fetchPdfText(sourceUrl);
      pdfLoaded = true;
      enrichmentError = null;
    } catch (error) {
      enrichmentError = error instanceof Error ? error.message : "Não foi possível ler o documento oficial.";
      console.warn(`Não foi possível detalhar a indicação ${number}/${year}:`, error);
    }
  }
  const details = buildIndicationDetails(summary, pdfText);
  const enrichmentStatus = enrichmentError && !pdfText
    ? "failed"
    : pdfText && details.enrichmentStatus === "pending" ? "manual_review" : details.enrichmentStatus;
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
      publicSummary: details.publicSummary,
      author: author || VEREADOR_NAME,
      status: "Protocolada",
      statusGroup: "protocolled",
      sourceUrl,
      location: details.location,
      neighborhood: details.neighborhood,
      service: details.service,
      reference: details.reference,
      fullText: details.fullText,
      lawNumber: null,
      lawDate: null,
      lawUrl: null,
      authorRole: "Autor principal",
      enrichmentStatus,
      enrichmentError,
      enrichmentAttempted,
      initialPublished: enrichmentStatus === "complete",
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

function metaContent(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const direct = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"));
  const reversed = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"));
  return he.decode(direct?.[1] || reversed?.[1] || "").trim();
}

function extractOfficialArticleBody(html: string) {
  const afterImage = html.match(
    /<a\b[^>]*class=["'][^"']*\bnoticia_imagem\b[^"']*["'][^>]*>[\s\S]*?<\/a>\s*([\s\S]*?)<div\b[^>]*class=["'][^"']*\bbotao_avisos\b/i,
  )?.[1]?.trim();
  if (afterImage) return afterImage;

  const end = html.search(/<div\b[^>]*class=["'][^"']*\bbotao_avisos\b/i);
  if (end < 0) return "";
  const articleStart = html.search(/<div\b[^>]*class=["'][^"']*\bpbw_main_article\b/i);
  const before = html.slice(Math.max(articleStart, 0), end);
  const starts = [...before.matchAll(/<div\b[^>]*>\s*<strong\b[^>]*>/gi)];
  const start = starts.at(-1)?.index;
  if (start === undefined) return "";
  return before.slice(start).trim();
}

function extractOfficialNarration(html: string) {
  const encoded = html.match(/campo_value\s*:\s*'([\s\S]*?)'\s*}\s*\)\s*;/i)?.[1];
  if (!encoded) return "";
  return he.decode(encoded)
    .replace(/\\'/g, "'")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function isBotVerification(html: string) {
  return /<title>\s*Bot Verification\s*<\/title>|^Title:\s*Bot Verification\s*$|lsrecaptcha-form|grecaptcha\.render/im.test(html);
}

function markdownExcerpt(markdown: string) {
  const text = markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[*_#>`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return concise(text, 300);
}

async function downloadOfficialCover(imageUrl: string) {
  if (!imageUrl) return null;
  const response = await fetchWithRetry(imageUrl, {
    headers: { "User-Agent": "JuniorCoringaMandato/1.0 (+https://juniorcoringa.com.br)" },
    cache: "no-store",
  }, `Imagem ${imageUrl}`);
  if (!response.ok) throw new Error(`Imagem oficial respondeu HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || "";
  const extensions: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
  };
  const extension = extensions[contentType];
  if (!extension) throw new Error(`Formato de imagem oficial não permitido: ${contentType || "desconhecido"}.`);
  const uploadsDir = path.join(DATA_DIR, "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });
  const filename = `camara-${createHash("sha256").update(imageUrl).digest("hex").slice(0, 24)}${extension}`;
  const destination = path.join(uploadsDir, filename);
  try {
    await fs.access(destination);
  } catch {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 12 * 1024 * 1024) throw new Error("Imagem oficial excede 12 MB.");
    const temporary = `${destination}.tmp-${process.pid}`;
    await fs.writeFile(temporary, bytes);
    await fs.rename(temporary, destination);
  }
  return `/media/${filename}`;
}

async function fetchOfficialPublications() {
  if (!CAMARA_API_TOKEN) return [] as OfficialPublication[];
  const url = new URL(CAMARA_API_URL);
  url.searchParams.set("keysoft", CAMARA_API_TOKEN);
  url.searchParams.set("call", "publicacoes");
  url.searchParams.set("tipo", "Noticias");
  url.searchParams.set("pagina", "1");
  const response = await fetchWithRetry(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  }, "API de notícias da Câmara");
  if (!response.ok) throw new Error(`API de notícias respondeu HTTP ${response.status}.`);
  const payload = await response.json() as unknown;
  return Array.isArray(payload) ? payload as OfficialPublication[] : [];
}

function extractOfficialNewsPdfText(pdfText: string) {
  const lines = pdfText.replace(/\r/g, "").split("\n");
  const sourceIndex = lines.findIndex((line) => /https?:\/\/\S+\/imprensa\//i.test(line));
  const contentLines = sourceIndex >= 0 ? lines.slice(sourceIndex + 1) : lines;
  const paragraphs: string[] = [];
  const repeatedHeader = /^(?:ESTADO DE MATO GROSSO DO SUL|CÂMARA MUNICIPAL DE CAMPO GRANDE|Avenida Ricardo Brandão, 1600|Fone: \(67\) 3316-1500|Página \d+\s+www\.camara\.ms\.gov\.br|-- \d+ of \d+ --)/i;

  for (const rawLine of contentLines) {
    const continuation = /^[\t ]/.test(rawLine);
    const line = rawLine.trim();
    if (!line || repeatedHeader.test(line)) continue;
    if (continuation && paragraphs.length) {
      paragraphs[paragraphs.length - 1] += `${paragraphs[paragraphs.length - 1].endsWith("-") ? "" : " "}${line}`;
    } else {
      paragraphs.push(line);
    }
  }

  return paragraphs.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

function canonicalOfficialNewsUrl(sourceUrl: string, publishedAt: string) {
  const url = new URL(sourceUrl);
  const publicationId = url.pathname.match(/\/(\d+)\/?$/)?.[1];
  const parsedYear = new Date(publishedAt).getFullYear();
  if (!publicationId || !Number.isFinite(parsedYear)) return sourceUrl;
  return new URL(`/imprensa/noticias/Noticias/1/${parsedYear}/${publicationId}`, url).toString();
}

function extractOfficialNewsHtml(html: string) {
  const imageUrl = metaContent(html, "og:image") || he.decode(html.match(/class=["'][^"']*noticia_imagem[^"']*["'][\s\S]*?<img[^>]+src=["']([^"']+)/i)?.[1] || "");
  const bodyHtml = extractOfficialArticleBody(html);
  const turndown = new TurndownService({ bulletListMarker: "-", emDelimiter: "_", strongDelimiter: "**" });
  const converted = bodyHtml ? turndown.turndown(bodyHtml).replace(/\n{3,}/g, "\n\n").trim() : "";
  return {
    article: converted.length >= 80 ? converted : extractOfficialNarration(html),
    imageUrl,
  };
}

function extractReaderNews(markdown: string) {
  if (isBotVerification(markdown)) throw new Error("O leitor público também recebeu Bot Verification.");
  const content = markdown.split(/\nMarkdown Content:\s*\n/i).at(-1) || "";
  const imageUrl = content.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+\/news\/[^)\s]+)\)/i)?.[1] || "";
  const lines = content.replace(/\r/g, "").split("\n");
  const start = lines.findIndex((line) => {
    const trimmed = line.trim();
    return Boolean(trimmed) && !trimmed.startsWith("[") && !/^imprimir\s+(?:PDF|DOC)/i.test(trimmed);
  });
  const bodyLines = start >= 0 ? lines.slice(start) : [];
  const end = bodyLines.findIndex((line) => /^\*{0,2}Protocolos desta Publica(?:ç|c)ão:/i.test(line.trim()));
  const article = (end >= 0 ? bodyLines.slice(0, end) : bodyLines).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (article.length < 80) throw new Error("O leitor público não retornou o corpo completo da matéria.");
  return { article, imageUrl };
}

async function fetchOfficialNewsReader(canonicalUrl: string) {
  const baseUrl = CAMARA_NEWS_READER_URL.endsWith("/") ? CAMARA_NEWS_READER_URL : `${CAMARA_NEWS_READER_URL}/`;
  const response = await fetchWithRetry(`${baseUrl}${canonicalUrl}`, {
    headers: {
      Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.1",
      "User-Agent": "JuniorCoringaMandato/1.0 (+https://juniorcoringa.com.br)",
    },
    cache: "no-store",
  }, "Leitor alternativo da matéria");
  if (!response.ok) throw new Error(`Leitor alternativo respondeu HTTP ${response.status}.`);
  return extractReaderNews(await response.text());
}

async function fetchOfficialNewsPdf(sourceUrl: string, publicationId: string) {
  const pdfUrl = new URL("/legislarr/noticia_print_pdf.php", sourceUrl);
  pdfUrl.searchParams.set("item", publicationId);
  pdfUrl.searchParams.set("assinatura", "0");
  const response = await fetchWithRetry(pdfUrl, {
    headers: {
      Accept: "application/pdf,*/*",
      "User-Agent": "JuniorCoringaMandato/1.0 (+https://juniorcoringa.com.br)",
    },
    cache: "no-store",
  }, `PDF da matéria ${publicationId}`);
  if (!response.ok) throw new Error(`PDF da matéria respondeu HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/pdf")) {
    const unexpectedContent = await response.text();
    if (isBotVerification(unexpectedContent)) throw new Error("A Câmara bloqueou também o PDF da matéria com Bot Verification.");
    throw new Error(`PDF da matéria retornou ${contentType || "um formato desconhecido"}.`);
  }
  const pdfText = await parsePdfText(new Uint8Array(await response.arrayBuffer()), { lineThreshold: 14, pageJoiner: "\n" });
  const article = extractOfficialNewsPdfText(pdfText);
  if (article.length < 80) throw new Error("O PDF oficial não contém o texto completo da matéria.");
  return article;
}

async function fetchOfficialNewsDetails(sourceUrl: string, officialImage: string | undefined, publishedAt: string) {
  const publicationId = new URL(sourceUrl).pathname.match(/\/(\d+)\/?$/)?.[1];
  const canonicalUrl = canonicalOfficialNewsUrl(sourceUrl, publishedAt);
  let article = "";
  if (publicationId) {
    try {
      article = await fetchOfficialNewsPdf(sourceUrl, publicationId);
    } catch (error) {
      console.warn(`Não foi possível obter o PDF oficial ${publicationId}:`, error);
    }
  }

  if (publicationId && article.length < 80) {
    try {
      const documentUrl = new URL("/legislarr/documento_print_doc.php", sourceUrl);
      documentUrl.searchParams.set("documento_tipo", "noticia");
      documentUrl.searchParams.set("documento", publicationId);
      const documentResponse = await fetchWithRetry(documentUrl, {
        headers: {
          Accept: "text/html,application/msword,*/*",
          "User-Agent": "JuniorCoringaMandato/1.0 (+https://juniorcoringa.com.br)",
        },
        cache: "no-store",
      }, `Documento da matéria ${publicationId}`);
      if (documentResponse.ok) {
        const documentHtml = await documentResponse.text();
        if (!isBotVerification(documentHtml)) {
          const turndown = new TurndownService({ bulletListMarker: "-", emDelimiter: "_", strongDelimiter: "**" });
          article = turndown.turndown(documentHtml).replace(/\n{3,}/g, "\n\n").trim();
        }
      }
    } catch (error) {
      console.warn(`Não foi possível obter o documento oficial ${publicationId}:`, error);
    }
  }

  let coverImage: string | null = null;
  let imageUrl = officialImage || "";
  if (imageUrl) {
    coverImage = await downloadOfficialCover(new URL(imageUrl, sourceUrl).toString());
  }

  if (article.length < 80 || !imageUrl) {
    for (const candidateUrl of [...new Set([canonicalUrl, sourceUrl])]) {
      try {
        const response = await fetchWithRetry(candidateUrl, {
          headers: {
            Accept: "text/html,application/xhtml+xml",
            "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
          cache: "no-store",
        }, `Matéria ${candidateUrl}`);
        if (!response.ok) throw new Error(`Matéria oficial respondeu HTTP ${response.status}.`);
        const html = await response.text();
        if (isBotVerification(html)) throw new Error("A Câmara bloqueou a consulta com Bot Verification.");
        const extracted = extractOfficialNewsHtml(html);
        article ||= extracted.article;
        imageUrl ||= extracted.imageUrl;
        if (imageUrl && !coverImage) coverImage = await downloadOfficialCover(new URL(imageUrl, candidateUrl).toString());
        if (article.length >= 80 && imageUrl) break;
      } catch (error) {
        console.warn(`Não foi possível ler a matéria pela rota ${candidateUrl}:`, error);
      }
    }
  }

  if (article.length < 80 || !imageUrl) {
    try {
      const reader = await fetchOfficialNewsReader(canonicalUrl);
      article ||= reader.article;
      imageUrl ||= reader.imageUrl;
      if (imageUrl && !coverImage) coverImage = await downloadOfficialCover(new URL(imageUrl, canonicalUrl).toString());
    } catch (error) {
      console.warn(`Não foi possível ler a matéria pelo leitor alternativo ${canonicalUrl}:`, error);
    }
  }

  if (article.length < 80) throw new Error("O texto completo da matéria ainda não está disponível.");
  if (imageUrl && !coverImage) throw new Error("A imagem da matéria ainda não pôde ser salva.");
  return {
    excerpt: markdownExcerpt(article),
    content: `${article}\n\n---\n\n[Fonte: Câmara Municipal de Campo Grande](${sourceUrl})`,
    coverImage,
  };
}

async function fetchOfficialNewsDetailsWithRetry(sourceUrl: string, officialImage: string | undefined, publishedAt: string) {
  let lastError: unknown;
  for (const [index, delayMs] of NEWS_DETAILS_RETRY_DELAYS_MS.entries()) {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      return await fetchOfficialNewsDetails(sourceUrl, officialImage, publishedAt);
    } catch (error) {
      lastError = error;
      if (index < NEWS_DETAILS_RETRY_DELAYS_MS.length - 1) {
        const reason = error instanceof Error ? error.message : "erro desconhecido";
        console.warn(`Detalhes de ${sourceUrl} incompletos; nova tentativa será feita: ${reason}`);
      }
    }
  }
  throw lastError;
}

async function fetchOfficialNews(): Promise<OfficialNewsBatch> {
  const [response, publications] = await Promise.all([
    fetchWithRetry(CAMARA_RSS_URL, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
    cache: "no-store",
    }, "RSS da Câmara"),
    fetchOfficialPublications().catch((error) => {
      console.warn("Não foi possível consultar as imagens na API oficial:", error);
      return [] as OfficialPublication[];
    }),
  ]);
  if (!response.ok) throw new Error(`RSS da Câmara respondeu HTTP ${response.status}.`);
  const xml = await response.text();
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(xml) as { rss?: { channel?: { item?: unknown | unknown[] } } };
  const rawItems = parsed.rss?.channel?.item;
  const items = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];
  const summaries = items.flatMap((raw) => {
    const item = raw as { title?: string; description?: string; link?: string; guid?: string; pubDate?: string };
    if (!containsJunior(`${item.title ?? ""} ${item.description ?? ""}`)) return [];
    const sourceUrl = String(item.link ?? item.guid ?? "").trim();
    const title = normalizeText(item.title);
    if (!sourceUrl || !title) return [];
    return [{
      sourceId: `camara-rss:${String(item.guid ?? sourceUrl)}`,
      sourceUrl,
      title,
      excerpt: normalizeText(item.description) || null,
      content: null as string | null,
      coverImage: null as string | null,
      publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
    }];
  });
  const enriched = await mapWithConcurrency(summaries, 3, async (item): Promise<OfficialNewsItem | null> => {
    try {
      const canonicalUrl = item.sourceUrl.replace(/#.*$/, "");
      const publication = publications.find((entry) => String(entry.link || "").replace(/#.*$/, "") === canonicalUrl);
      return { ...item, ...await fetchOfficialNewsDetailsWithRetry(item.sourceUrl, publication?.imagem, publication?.data || item.publishedAt) };
    } catch (error) {
      console.warn(`A matéria ${item.sourceUrl} ficou pendente para não ser publicada sem texto ou imagem:`, error);
      return null;
    }
  });
  const completeItems = enriched.filter((item): item is OfficialNewsItem => Boolean(item));
  return { items: completeItems, pending: enriched.length - completeItems.length };
}

export async function syncCamaraData(mode: CamaraSyncMode = "daily", trigger: CamaraSyncTrigger = "manual"): Promise<CamaraSyncResult> {
  const runId = startCamaraSyncRun(mode, trigger);
  if (runId === null) throw new Error("Já existe uma sincronização da Câmara em andamento.");
  const heartbeat = setInterval(() => {
    try {
      heartbeatCamaraSyncRun(runId);
    } catch (error) {
      console.warn(`Não foi possível renovar o bloqueio da sincronização ${runId}:`, error);
    }
  }, 15_000);
  heartbeat.unref();
  try {
    const currentYear = new Date().getFullYear();
    const emptyNews: OfficialNewsBatch = { items: [], pending: 0 };
    const [projectRows, indicationRows, news] = mode === "history"
      ? [await fetchLegislativeRows("Ato", "projeto"), [], emptyNews]
      : mode === "indications"
        ? [[], await fetchLegislativeRows("Documento", "documento"), emptyNews]
        : await Promise.all([
            fetchLegislativeRows("Ato", "projeto", currentYear),
            fetchLegislativeRows("Documento", "documento", currentYear),
            fetchOfficialNews(),
          ]);
    const projects = projectRows
      .map(projectFromRow)
      .filter((item): item is LegislativeItemInput => Boolean(item))
      .filter((item) => mode === "daily" || Boolean(item.lawUrl));
    const enrichmentPriority = new Map<unknown[], number>();
    for (const row of indicationRows) {
      const documentId = normalizeText(row[7]);
      const existing = documentId ? getLegislativeItemByExternalId(`camara-indication:${documentId}`) : null;
      enrichmentPriority.set(row, existing && ["pending", "failed", "manual_review"].includes(existing.enrichmentStatus) ? 0 : existing ? 2 : 1);
    }
    indicationRows.sort((a, b) => {
      const priority = (row: unknown[]) => {
        return enrichmentPriority.get(row) ?? 2;
      };
      return priority(a) - priority(b) || parseBrazilianDate(b[3]).localeCompare(parseBrazilianDate(a[3]));
    });
    const configuredPdfLimit = mode === "indications" ? PDF_BACKFILL_PER_RUN : PDF_DETAILS_PER_RUN;
    let remainingPdfDetails = Number.isFinite(configuredPdfLimit) ? Math.max(configuredPdfLimit, 0) : mode === "indications" ? 250 : 50;
    const parsedIndications = await mapWithConcurrency(indicationRows, 4, async (row) => {
      const documentId = normalizeText(row[7]);
      const existing = documentId ? getLegislativeItemByExternalId(`camara-indication:${documentId}`) : null;
      const isIndication = normalizeForComparison(getDefinitionValue(row[0], "Tipo")) === "indicacao";
      const rowSummary = normalizeText(row[5]) || getDefinitionValue(row[0], "Assunto");
      const preview = isIndication && rowSummary ? buildIndicationDetails(rowSummary, existing?.fullText ?? null) : null;
      const needsEnrichment = !existing || ["pending", "failed", "manual_review"].includes(existing.enrichmentStatus) || preview?.enrichmentStatus === "pending";
      const loadPdf = isIndication && needsEnrichment && !existing?.fullText && remainingPdfDetails > 0;
      if (loadPdf) remainingPdfDetails -= 1;
      return indicationFromRow(row, loadPdf);
    });
    const indications = parsedIndications.map((entry) => entry.item).filter((item): item is LegislativeItemInput => Boolean(item));
    const items = [...projects, ...indications];
    const counts = { inserted: 0, updated: 0, unchanged: 0 };
    for (const item of items) counts[upsertLegislativeItem(item)] += 1;
    const newsCounts = { inserted: 0, updated: 0, unchanged: 0 };
    for (const item of news.items) newsCounts[createOfficialNewsPost(item)] += 1;
    const retitled = retitleStoredIndications();
    const result: CamaraSyncResult = {
      mode,
      found: items.length,
      inserted: counts.inserted,
      updated: counts.updated,
      unchanged: counts.unchanged,
      newsInserted: newsCounts.inserted,
      newsUpdated: newsCounts.updated,
      newsPending: news.pending,
      projects: projects.length,
      indications: indications.length,
      pdfDetails: parsedIndications.filter((entry) => entry.pdfLoaded).length,
      retitled,
      enriched: indications.filter((item) => item.enrichmentStatus === "complete").length,
      pending: indications.filter((item) => item.enrichmentStatus === "pending").length,
      failed: indications.filter((item) => item.enrichmentStatus === "failed").length,
      manualReview: indications.filter((item) => item.enrichmentStatus === "manual_review").length,
    };
    finishCamaraSyncRun(runId, { status: "success", ...result });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido na sincronização.";
    finishCamaraSyncRun(runId, { status: "error", error: message.slice(0, 1000) });
    throw error;
  } finally {
    clearInterval(heartbeat);
  }
}
