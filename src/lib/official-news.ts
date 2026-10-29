import * as he from "he";
import type { OfficialNewsCandidate } from "@/lib/types";

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
    const sourceUrl = new URL(he.decode(match[1]), archiveUrl).toString().replace(/#.*$/, "");
    if (!detailPattern.test(new URL(sourceUrl).pathname)) continue;
    const text = plainText(match[2]);
    const parsed = text.match(/NOT[IÍ]CIAS\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+(.+)/i);
    if (!parsed?.[3]) continue;
    const sourceId = stableOfficialNewsSourceId(sourceUrl);
    candidates.set(sourceId, {
      sourceId,
      sourceUrl,
      title: parsed[3].trim(),
      excerpt: null,
      imageUrl: null,
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
