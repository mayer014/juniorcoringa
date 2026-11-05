import assert from "node:assert/strict";
import test from "node:test";
import { mergeOfficialNewsCandidates, newsPageReachedCutoff, newsUpdateCutoff, officialNewsDate, officialNewsImage, parseOfficialMemberNewsArchive, stableOfficialNewsSourceId } from "./official-news";

test("a atualização para na janela recente e não encerra diante de uma página inválida ou desordenada", () => {
  const cutoff = newsUpdateCutoff("2026-11-05T12:00:00Z");
  assert.equal(cutoff, "2026-11-03T12:00:00.000Z");
  assert.equal(newsPageReachedCutoff(["2026-11-06T12:00:00Z", "2026-11-04T12:00:00Z"], 2, cutoff), false);
  assert.equal(newsPageReachedCutoff(["2026-11-05T12:00:00Z", "2026-11-02T12:00:00Z"], 2, cutoff), true);
  assert.equal(newsPageReachedCutoff(["2026-11-02T12:00:00Z", "2026-11-05T12:00:00Z"], 2, cutoff), false);
  assert.equal(newsPageReachedCutoff(["2026-11-01T12:00:00Z"], 2, cutoff), false);
});

test("usa a foto da matéria mesmo quando og:image anuncia o logotipo genérico", () => {
  const generic = '<meta property="og:image" content="https://www.camara.ms.gov.br/news/noimage.jpg">';
  const photo = '<a class="viewbox noticia_imagem"><img src="https://www.camara.ms.gov.br/news/2026/10/postes.png"></a>';
  assert.equal(officialNewsImage(generic + photo), "https://www.camara.ms.gov.br/news/2026/10/postes.png");
  assert.equal(officialNewsImage(generic), "");
});

test("preserva a data antiga da API em vez de trocar pela data de importação", () => {
  assert.equal(officialNewsDate("2026-07-02 12:44:00"), "2026-07-02T12:44:00-04:00");
  assert.equal(officialNewsDate("02/07/2026 12:44"), "2026-07-02T12:44:00-04:00");
  assert.throws(() => officialNewsDate("sem data"), /data válida/);
  assert.throws(() => officialNewsDate("2026-99-14 12:00:00"), /data válida/);
});

test("lê o arquivo de notícias do vereador e preserva o identificador oficial", () => {
  const archive = `
    <a href="/camara/membros/show/14/noticias/1/40257">
      <span>NOTÍCIAS</span><time>14/10/2026 13:23</time>
      Junior Coringa acompanha instalação de postes nas Moreninhas
      <div style="background-image:url(/news/postes_thumb.png);"></div>
    </a>
    <a href="javascript:void(0)">Navegação</a>
    <a href="/camara/membros/show/15/noticias/1/99999">NOTÍCIAS 14/10/2026 13:23 Outra matéria</a>
  `;
  const items = parseOfficialMemberNewsArchive(archive, "https://www.camara.ms.gov.br/camara/membros/show/14/noticias/1");

  assert.equal(items.length, 1);
  assert.equal(items[0].sourceId, "camara-news:40257");
  assert.equal(items[0].publishedAt, "2026-10-14T13:23:00-04:00");
  assert.match(items[0].title, /instalação de postes/i);
  assert.equal(items[0].imageUrl, "https://www.camara.ms.gov.br/news/postes_thumb.png");
  assert.equal(stableOfficialNewsSourceId(items[0].sourceUrl), "camara-news:40257");
});

test("combina fontes da Câmara sem duplicar a mesma matéria", () => {
  const combined = mergeOfficialNewsCandidates(
    [{ sourceId: "camara-news:40257", sourceUrl: "https://camara.test/40257", title: "Título", excerpt: "Resumo RSS", imageUrl: null, publishedAt: "2026-10-14T13:23:00-04:00" }],
    [{ sourceId: "camara-news:40257", sourceUrl: "https://camara.test/40257", title: "Título", excerpt: null, imageUrl: "https://camara.test/imagem.jpg", publishedAt: "2026-10-14T13:23:00-04:00" }],
  );

  assert.equal(combined.length, 1);
  assert.equal(combined[0].excerpt, "Resumo RSS");
  assert.equal(combined[0].imageUrl, "https://camara.test/imagem.jpg");
});
