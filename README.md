# Site do Vereador Junior Coringa

Portal institucional e painel de publicações do mandato do vereador Junior Coringa, de Campo Grande/MS.

## O que está incluído

- página inicial responsiva com identidade visual própria e animações de rolagem;
- destaque para a defesa do autismo e da inclusão;
- arquivo público de notícias, projetos, agendas e conteúdos de inclusão;
- busca e filtros por categoria;
- página individual para cada matéria;
- painel protegido em `/admin`;
- criação, edição, rascunho, publicação, destaque e exclusão de matérias;
- upload e otimização automática da imagem de capa;
- banco SQLite e imagens em volume persistente;
- Dockerfile pronto para EasyPanel.

## Desenvolvimento local

Requer Node.js 22 ou superior.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3000`. O painel fica em `http://localhost:3000/admin`.

Em desenvolvimento, se nenhuma credencial for configurada, o acesso provisório é:

- e-mail: `admin@juniorcoringa.com.br`
- senha: `troque-esta-senha`

Essa senha de desenvolvimento não funciona em produção.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | URL pública completa do site |
| `ADMIN_EMAIL` | e-mail de acesso ao painel |
| `ADMIN_PASSWORD` | senha do painel; use uma senha longa e exclusiva |
| `ADMIN_PASSWORD_HASH` | alternativa opcional a `ADMIN_PASSWORD`, usando hash bcrypt |
| `SESSION_SECRET` | chave aleatória longa usada para assinar a sessão |
| `DATA_DIR` | diretório persistente do banco e dos uploads |
| `CAMARA_SYNC_SECRET` | segredo do endpoint interno de sincronização |
| `CAMARA_PDF_DETAILS_LIMIT` | quantidade máxima de PDFs novos detalhados por execução |
| `CAMARA_NEWS_READER_URL` | leitor alternativo usado somente quando a Câmara bloqueia o corpo de uma matéria |
| `CAMARA_NEWS_REQUEST_TIMEOUT_MS` | prazo por consulta de notícias, em milissegundos; padrão `8000` (aceita `8_000`), entre 1000 e 15000 |
| `TZ` | fuso da aplicação; use `America/Cuiaba` |

Quando `ADMIN_PASSWORD_HASH` estiver definido, ele tem prioridade sobre `ADMIN_PASSWORD`.

## EasyPanel

As instruções de implantação estão em [DEPLOY-EASYPANEL.md](./DEPLOY-EASYPANEL.md).

## Recuperar notícias da Câmara

Em `/admin/integracao`, use **Atualizar notícias (7 dias)** no dia a dia. A descoberta e a recuperação da fila ficam sempre limitadas aos sete dias anteriores, mesmo que o ponto de atualização persistido no SQLite esteja antigo. Matérias completas não são baixadas novamente, e falhas recentes permanecem disponíveis para uma nova tentativa. Pendências mais antigas ficam reservadas ao fluxo de recuperação histórica.

Para buscar o acervo antigo e retomar todas as pendências, abra **Recuperação de notícias antigas → Continuar recuperação antiga**. A próxima página é salva depois de cada página importada; um clique posterior retoma desse cursor, em vez de reiniciar. Um lote percorre no máximo 200 páginas antes de processar a fila completa. Um histórico já concluído não é percorrido novamente. **Revisar todo o histórico desde o início** é a opção explícita para reiniciar a varredura, sem excluir publicações, pendências ou o ponto de atualização das novidades. Instalações anteriores a essa versão preservam o acervo já identificado; o cursor histórico passa a ser salvo a partir desta versão.

Cada matéria é recuperada em uma requisição separada, com limite total de 20 segundos e progresso na tela. O leitor público é consultado antes das rotas da Câmara que costumam bloquear a VPS, evitando que elas consumam todo o prazo antes do fallback. **Pausar importação** encerra a sequência após a matéria atual.

A descoberta consulta de forma independente a página do vereador, o RSS e a API autenticada; a recuperação histórica também usa o acervo local. Se a página receber Bot Verification, a API continua com uma página por requisição. A atualização normal para na janela recente; a recuperação antiga prossegue até uma página vazia ou o limite do lote. Páginas repetidas interrompem a busca sem perder o progresso. O painel identifica as fontes utilizadas e as indisponíveis.

`seed/camara-news-recovery/` contém 25 matérias oficiais verificadas em 05/11/2026, com texto, data, link da fonte e imagem. O Dockerfile inclui esse diretório na imagem. Ele permite recuperar essas matérias sem conexão do servidor com a Câmara e não é apresentado como um catálogo atualizado em tempo real. Para gerar uma nova versão a partir da fonte oficial acessível, use `node scripts/verify-camara-news.mjs --live --export-recovery` depois do build; revise e publique o acervo gerado junto com o código. A API/RSS continuam descobrindo matérias posteriores à cópia.

Somente matérias com texto completo e imagem são concluídas. Falhas ficam registradas para nova tentativa. A importação preserva textos e imagens existentes, evita duplicações pelo código oficial e recoloca antigos registros incompletos na fila de recuperação.

Após `npm run build`, execute `node scripts/verify-camara-news.mjs` para testar login, importação, páginas públicas, duplicidade e falha da fonte via HTTP em um banco temporário. Acrescente `--live` para verificar o mesmo fluxo com a Câmara real e as três matérias reportadas como ausentes. Nenhum desses testes modifica o banco de produção.

Para simular o problema da VPS, execute `node scripts/verify-camara-news.mjs --blocked-archive` (página e HTML das matérias bloqueados, recuperação pela API e exportação oficial DOC) e `node scripts/verify-camara-news.mjs --recovery-only` (fontes externas indisponíveis, importação pelo acervo salvo). Ambos validam texto, imagem, página pública e ausência de duplicações.

## Backup

Todo o conteúdo criado pelo painel fica no volume montado em `/app/data`:

- `junior-coringa.sqlite`: matérias e metadados;
- `uploads/`: imagens das matérias.

Para um backup completo, copie esse diretório com o aplicativo parado ou usando o recurso de snapshot/backup do provedor.

## Importação do site antigo

O backup WordPress pode ser auditado sem alterar o banco:

```powershell
npm.cmd run import:wordpress -- "C:\caminho\backup.xml" --dry-run
```

Para importar matérias e baixar as imagens:

```powershell
npm.cmd run import:wordpress -- "C:\caminho\backup.xml" --download-media
```

O importador corrige a codificação, converte o HTML para Markdown, preserva datas e rascunhos, evita duplicações e bloqueia padrões de spam encontrados no backup. O relatório da triagem fica em `data/backups/relatorio-importacao-wordpress.json`.

Depois da revisão, gere o conteúdo inicial usado no primeiro deploy:

```powershell
npm.cmd run package:seed
```

O contêiner só instala esse conteúdo se o volume ainda não possuir banco. Publicações criadas posteriormente nunca são substituídas por esse processo.
