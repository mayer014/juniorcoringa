import assert from "node:assert/strict";
import test from "node:test";
import { mergeOfficialNewsCandidates, officialNewsDate, parseOfficialMemberNewsArchive, stableOfficialNewsSourceId } from "./official-news";

test("preserva a data antiga da API em vez de trocar pela data de importação", () => {
  assert.equal(officialNewsDate("2026-07-02 12:44:00"), "2026-07-02T12:44:00-04:00");
  assert.equal(officialNewsDate("02/07/2026 12:44"), "2026-07-02T12:44:00-04:00");
  assert.throws(() => officialNewsDate("sem data"), /data válida/);
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
