import { XMLParser } from "fast-xml-parser";
import TurndownService from "turndown";

const token = process.env.CAMARA_API_TOKEN;
const secret = process.env.CAMARA_SYNC_SECRET;
const site = process.env.SITE_URL || "https://juniorcoringa.com.br";
if (!token || !secret) throw new Error("CAMARA_API_TOKEN e CAMARA_SYNC_SECRET são obrigatórios.");

const [rssText, publications] = await Promise.all([
  fetch("https://www.camara.ms.gov.br/jsonweb/web-rss.php").then((r) => r.text()),
  fetch(`https://www.camara.ms.gov.br/jsonweb/web-aplicativo.php?keysoft=${encodeURIComponent(token)}&call=publicacoes&tipo=Noticias&pagina=1`).then((r) => r.json()),
]);
const parsed = new XMLParser({ ignoreAttributes: false }).parse(rssText);
const rssItems = Array.isArray(parsed?.rss?.channel?.item) ? parsed.rss.channel.item : [];
const juniorItems = rssItems.filter((item) => /junior coringa/i.test(String(item.title || "")));
const turndown = new TurndownService({ strongDelimiter: "**" });
const items = [];
for (const item of juniorItems) {
  const sourceUrl = String(item.link || item.guid).replace(/#.*$/, "");
  const publication = publications.find((entry) => String(entry.link || "").replace(/#.*$/, "") === sourceUrl);
  const html = await fetch(sourceUrl).then((r) => r.text());
  if (/Bot Verification|lsrecaptcha-form/i.test(html)) throw new Error(`Coleta externa bloqueada: ${sourceUrl}`);
  const body = html.match(/<a\b[^>]*class=["'][^"']*\bnoticia_imagem\b[^"']*["'][^>]*>[\s\S]*?<\/a>\s*([\s\S]*?)<div\b[^>]*class=["'][^"']*\bbotao_avisos\b/i)?.[1];
  if (!body) throw new Error(`Texto não localizado: ${sourceUrl}`);
  const content = turndown.turndown(body).replace(/\n{3,}/g, "\n\n").trim();
  const excerpt = content.replace(/[*_#>`~]/g, "").replace(/\s+/g, " ").trim().slice(0, 300);
  const imageUrl = publication?.imagem;
  const imageBase64 = imageUrl ? Buffer.from(await fetch(imageUrl).then((r) => r.arrayBuffer())).toString("base64") : "";
  items.push({ sourceUrl, title: String(item.title), publishedAt: new Date(item.pubDate).toISOString(), excerpt, content: `${content}\n\n---\n\n[Fonte: Câmara Municipal de Campo Grande](${sourceUrl})`, imageBase64 });
}
const headers = { authorization: `Bearer ${secret}`, "content-type": "application/json" };
const newsResponse = await fetch(`${site}/api/internal/camara/news`, { method: "POST", headers, body: JSON.stringify({ items }) });
if (!newsResponse.ok) throw new Error(`Envio de notícias falhou: ${newsResponse.status} ${await newsResponse.text()}`);
console.log("Notícias:", await newsResponse.text());
const legislativeResponse = await fetch(`${site}/api/internal/camara/sync`, { method: "POST", headers });
if (!legislativeResponse.ok) throw new Error(`Sincronização legislativa falhou: ${legislativeResponse.status} ${await legislativeResponse.text()}`);
console.log("Legislativo:", await legislativeResponse.text());
