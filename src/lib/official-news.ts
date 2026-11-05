import * as he from "he";
import type { OfficialNewsCandidate } from "@/lib/types";

export type OfficialNewsSource = {
  source: "archive" | "rss" | "api" | "recovery";
  status: "ok" | "unavailable";
  found: number;
  message?: string;
};

export type NewsSyncProgress = {
  watermark: string | null;
  lastCheckedAt: string | null;
  nextHistoryPage: number;
  historyComplete: boolean;
};

export function newsUpdateCutoff(watermark: string | null, now = Date.now()) {
  // A two-day overlap catches delayed publication/indexing without reopening the old archive.
  return new Date(watermark ? Date.parse(watermark) - 2 * 86400000 : now - 7 * 86400000).toISOString();
}

export function newsPageReachedCutoff(dates: string[], totalEntries: number, cutoff: string) {
  if (!totalEntries || dates.length !== totalEntries) return false;
  const times = dates.map(Date.parse);
  if (times.some((time) => !Number.isFinite(time))) return false;
  const boundary = Date.parse(cutoff);
  const descending = times.every((time, index) => index === 0 || time <= times[index - 1]);
  return Math.max(...times) < boundary || (descending && Math.min(...times) < boundary);
}

export function officialNewsDate(value: string | undefined) {
  const iso = value?.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})?$/);
  const brazilian = value?.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2})(?::(\d{2}))?)?/);
  const date = iso ? `${iso[1]}T${iso[2]}${iso[3] || "-04:00"}`
    : brazilian ? `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}T${brazilian[4] || "12:00"}:${brazilian[5] || "00"}-04:00` : null;
  if (date && Number.isFinite(Date.parse(date))) return date;
  throw new Error("A fonte oficial não informou uma data válida para a matéria.");
}

export function officialNewsPublicationId(value: string) {
  try {
    return new URL(value).pathname.match(/\/(\d+)\/?$/)?.[1] ?? null;
  } catch {
    return value.match(/\/(\d+)\/?(?:#.*)?$/)?.[1] ?? null;
  }
}

export function stableOfficialNewsSourceId(sourceUrl: string) {
  const publicationId = officialNewsPublicationId(sourceUrl);
  return publicationId ? `camara-news:${publicationId}` : `camara-news:${sourceUrl.replace(/#.*$/, "")}`;
}

function plainText(html: string) {
  return he.decode(html.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

export function hasFullOfficialNewsContent(content: string | null | undefined) {
  const body = (content || "")
    .replace(/\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/Notícia publicada pela Câmara Municipal de Campo Grande sobre a atuação do vereador Junior Coringa\./gi, "")
    .replace(/[*_#>`~\s-]+/g, " ")
    .trim();
  return body.length >= 80;
}

export function officialNewsImage(html: string) {
  const articleImage = html.match(/class=["'][^"']*\bnoticia_imagem\b[^"']*["'][\s\S]*?<img[^>]+src=["']([^"']+)/i)?.[1];
  const socialImage = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1]
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  const candidate = he.decode(articleImage || socialImage || "");
  return /\/noimage\.[^/?#]+(?:[?#]|$)/i.test(candidate) ? "" : candidate;
}

function parseOfficialDate(date: string, time: string) {
  const [day, month, year] = date.split("/");
  return `${year}-${month}-${day}T${time}:00-04:00`;
}

export function parseOfficialMemberNewsArchive(
  html: string,
  archiveUrl: string,
  memberId = "14",
): OfficialNewsCandidate[] {
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const detailPattern = new RegExp(`/camara/membros/show/${memberId}/noticias/1/(\\d+)/?$`, "i");
  const candidates = new Map<string, OfficialNewsCandidate>();

  for (const match of html.matchAll(anchorPattern)) {
    let source: URL;
    try {
      source = new URL(he.decode(match[1]), archiveUrl);
    } catch {
      continue;
    }
    if (source.origin !== new URL(archiveUrl).origin) continue;
    const sourceUrl = source.toString().replace(/#.*$/, "");
    if (!detailPattern.test(new URL(sourceUrl).pathname)) continue;
    const text = plainText(match[2]);
    const parsed = text.match(/NOT(?:I|\u00cd)CIAS\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(.+)/i);
    if (!parsed?.[3]) continue;
    const sourceId = stableOfficialNewsSourceId(sourceUrl);
    const image = match[2].match(/background-image\s*:\s*url\(\s*["']?([^\s)"']+)/i)?.[1]
      || match[2].match(/<img\b[^>]*src=["']([^"']+)/i)?.[1];
    let imageUrl: string | null = null;
    if (image) {
      try {
        const resolved = new URL(he.decode(image), archiveUrl);
        if (["https:", "http:"].includes(resolved.protocol)) imageUrl = resolved.toString();
      } catch { /* A malformed thumbnail must not discard the article. */ }
    }
    candidates.set(sourceId, {
      sourceId,
      sourceUrl,
      title: parsed[3].trim(),
      excerpt: null,
      imageUrl,
      publishedAt: parseOfficialDate(parsed[1], parsed[2]),
    });
  }

  return [...candidates.values()];
}

export function mergeOfficialNewsCandidates(...groups: OfficialNewsCandidate[][]) {
  const merged = new Map<string, OfficialNewsCandidate>();
  for (const candidate of groups.flat()) {
    const current = merged.get(candidate.sourceId);
    merged.set(candidate.sourceId, {
      ...current,
      ...candidate,
      excerpt: candidate.excerpt || current?.excerpt || null,
      imageUrl: candidate.imageUrl || current?.imageUrl || null,
    });
  }
  return [...merged.values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
