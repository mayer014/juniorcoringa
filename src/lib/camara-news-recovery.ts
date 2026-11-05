import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { hasFullOfficialNewsContent, stableOfficialNewsSourceId } from "@/lib/official-news";
import type { OfficialNewsCandidate } from "@/lib/types";

type RecoveryArticle = OfficialNewsCandidate & { content: string; excerpt: string; coverFile: string };
type RecoveryArchive = { retrievedAt: string; sourceUrl: string; articles: RecoveryArticle[] };

const recoveryDir = path.resolve(/* turbopackIgnore: true */ process.env.CAMARA_NEWS_RECOVERY_DIR || path.join(process.cwd(), "seed", "camara-news-recovery"));
const dataDir = path.resolve(/* turbopackIgnore: true */ process.env.DATA_DIR || path.join(process.cwd(), "data"));

export async function readNewsRecovery(): Promise<RecoveryArchive | null> {
  let raw: string;
  try {
    raw = await fs.readFile(path.join(recoveryDir, "archive.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  const archive = JSON.parse(raw) as RecoveryArchive;
  if (!Array.isArray(archive.articles) || !Number.isFinite(Date.parse(archive.retrievedAt))) {
    throw new Error("O acervo local de recuperação é inválido.");
  }
  for (const article of archive.articles) {
    const source = new URL(article.sourceUrl);
    if (source.protocol !== "https:" || !["www.camara.ms.gov.br", "camara.ms.gov.br"].includes(source.hostname)
      || article.sourceId !== stableOfficialNewsSourceId(article.sourceUrl)
      || !hasFullOfficialNewsContent(article.content)
      || !/^[\w-]+\.(?:png|jpg|webp|avif)$/.test(article.coverFile)) {
      throw new Error("O acervo contém uma matéria sem origem oficial, texto ou imagem válidos.");
    }
  }
  return archive;
}

export async function recoverNewsDetails(sourceId: string) {
  const archive = await readNewsRecovery();
  const article = archive?.articles.find((entry) => entry.sourceId === sourceId);
  if (!article) return null;
  const image = await fs.readFile(path.join(recoveryDir, "uploads", article.coverFile));
  const extension = path.extname(article.coverFile);
  const filename = `camara-recovery-${createHash("sha256").update(image).digest("hex").slice(0, 24)}${extension}`;
  const uploads = path.join(dataDir, "uploads");
  await fs.mkdir(uploads, { recursive: true });
  await fs.writeFile(path.join(uploads, filename), image);
  return { content: article.content, excerpt: article.excerpt, coverImage: `/media/${filename}` };
}
