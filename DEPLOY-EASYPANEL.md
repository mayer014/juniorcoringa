# Implantação no EasyPanel

## 1. Crie o serviço

No projeto do EasyPanel, crie um serviço do tipo **App** conectado a este repositório GitHub e escolha **Dockerfile** como método de build. O contêiner expõe a porta `3000`.

## 2. Configure o domínio

Adicione o domínio desejado ao serviço e direcione-o para a porta `3000`. Ative HTTPS no próprio EasyPanel.

## 3. Adicione um volume persistente

Crie um volume e monte-o exatamente em:

```text
/app/data
```

Sem esse volume, matérias e imagens seriam perdidas ao recriar o contêiner.

Na primeira inicialização de um volume vazio, o contêiner instala automaticamente o acervo importado do WordPress. Nas inicializações seguintes, o banco e as novas publicações do painel são preservados sem sobrescrita.

## 4. Defina as variáveis

Adicione estas variáveis na seção Environment:

```text
NEXT_PUBLIC_SITE_URL=https://seudominio.com.br
ADMIN_EMAIL=seu-email@dominio.com.br
ADMIN_PASSWORD=uma-senha-longa-e-unica
SESSION_SECRET=uma-chave-aleatoria-com-pelo-menos-48-caracteres
CAMARA_API_URL=https://www.camara.ms.gov.br/jsonweb/web-aplicativo.php
CAMARA_API_TOKEN=seu-token-de-dados-abertos
CAMARA_VEREADOR_NOME=Junior Coringa
CAMARA_SYNC_SECRET=outro-segredo-aleatorio-com-pelo-menos-48-caracteres
DATA_DIR=/app/data
```

Para gerar o segredo da sessão em um terminal:

```bash
openssl rand -base64 48
```

Não reutilize a senha do GitHub, Hostinger ou EasyPanel.

## 5. Agende a integração da Câmara a cada 6 horas

O site possui a rota protegida `POST /api/internal/camara/sync`. Configure no agendador da VPS ou do EasyPanel:

```cron
0 */6 * * *
```

Requisição executada pelo agendamento:

```bash
curl --fail --silent --show-error --max-time 120 \
  --request POST \
  --header "Authorization: Bearer SEU_CAMARA_SYNC_SECRET" \
  https://juniorcoringa.com.br/api/internal/camara/sync
```

Substitua `SEU_CAMARA_SYNC_SECRET` pelo mesmo valor configurado no aplicativo. Como proteção adicional, a página inicial também dispara uma sincronização em segundo plano quando os dados estão há mais de 6 horas sem atualização. A rota impede execuções simultâneas.

## 6. Faça o deploy

Inicie o deploy. O EasyPanel fará o build da imagem e usará o health check em `/api/health`. Depois que o serviço estiver saudável:

- acesse o domínio para conferir o site;
- abra `/admin`;
- entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`;
- crie a primeira matéria.

## Atualizações

Depois de cada `git push`, faça um novo deploy pelo EasyPanel ou ative o deploy automático do repositório. O volume de `/app/data` deve continuar conectado em todas as versões.
