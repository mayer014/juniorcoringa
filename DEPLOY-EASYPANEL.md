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

No EasyPanel, confirme que o armazenamento aparece vinculado ao aplicativo `junior-coringa` e que o **Mount Path** é exatamente `/app/data`. Não use `/data`, `/app` nem um caminho temporário. O painel administrativo exibe um alerta quando o processo não detecta esse volume separado.

Na primeira inicialização de um volume vazio, o contêiner instala automaticamente o acervo importado do WordPress. Nas inicializações seguintes, o banco e as novas publicações do painel são preservados sem sobrescrita.

## 4. Defina as variáveis

Adicione estas variáveis na seção Environment:

```text
NEXT_PUBLIC_SITE_URL=https://seudominio.com.br
ADMIN_EMAIL=seu-email@dominio.com.br
ADMIN_PASSWORD=uma-senha-longa-e-unica
SESSION_SECRET=uma-chave-aleatoria-com-pelo-menos-48-caracteres
CITIZEN_DATA_SECRET=outra-chave-aleatoria-com-pelo-menos-48-caracteres
EVOLUTION_API_URL=https://evolution.seudominio.com.br
EVOLUTION_API_KEY=chave-da-evolution
EVOLUTION_INSTANCE=mandato-junior-coringa
EVOLUTION_WEBHOOK_SECRET=outro-segredo-aleatorio-com-pelo-menos-48-caracteres
EVOLUTION_SEND_ENABLED=false
COMMUNICATIONS_CRON_SECRET=mais-um-segredo-aleatorio-com-pelo-menos-48-caracteres
CAMARA_API_URL=https://www.camara.ms.gov.br/jsonweb/web-aplicativo.php
CAMARA_API_TOKEN=seu-token-de-dados-abertos
CAMARA_VEREADOR_NOME=Junior Coringa
CAMARA_SYNC_SECRET=outro-segredo-aleatorio-com-pelo-menos-48-caracteres
CAMARA_PDF_DETAILS_LIMIT=50
TZ=America/Cuiaba
DATA_DIR=/app/data
```

Para gerar os segredos da sessão e dos dados dos moradores em um terminal, execute o comando duas vezes e use resultados diferentes:

```bash
openssl rand -base64 48
```

Não reutilize a senha do GitHub, Hostinger ou EasyPanel.

## 5. Agende a integração da Câmara diariamente às 06:00

O site possui a rota protegida `POST /api/internal/camara/sync`. Configure no agendador da VPS ou do EasyPanel:

```cron
0 6 * * *
```

Requisição executada pelo agendamento:

```bash
curl --fail --silent --show-error --max-time 900 \
  --request POST \
  --header "Authorization: Bearer SEU_CAMARA_SYNC_SECRET" \
  https://juniorcoringa.com.br/api/internal/camara/sync
```

Substitua `SEU_CAMARA_SYNC_SECRET` pelo mesmo valor configurado no aplicativo. O agendador deve usar `America/Cuiaba`. Se ele operar exclusivamente em UTC, use `0 10 * * *`, equivalente às 06:00 de Campo Grande. A rota impede execuções simultâneas e a navegação de visitantes não dispara sincronizações.

Após a implantação, use **Sincronizar agora** no painel para buscar somente os registros do ano corrente. Essa rotina é incremental, não revisita anos anteriores e só abre o PDF de uma indicação quando ela ainda não existe no banco.

Use **Importar histórico de leis** uma vez para carregar todos os projetos antigos que possuam vínculo oficial com lei aprovada. Essa importação não busca indicações antigas. As duas rotinas são idempotentes: podem ser executadas novamente sem duplicar registros.

Se o banco precisar ser reconstruído, use **Restaurar histórico de indicações** uma única vez. Essa operação consulta todas as indicações disponíveis no portal e pode demorar alguns minutos. Só a execute depois de confirmar o volume persistente em `/app/data`; as sincronizações diárias posteriores continuam consultando somente o ano atual.

Na mesma página administrativa, a lista **Registros da Câmara** permite buscar, filtrar, ocultar, voltar a exibir ou excluir um registro. Itens ocultos e excluídos não são reativados pelas sincronizações seguintes.

## 6. Conecte a Evolution API sem ativar envios

Na Evolution Manager, crie uma instância com integração **WhatsApp Baileys**, sem sincronizar o histórico completo e ignorando grupos. No celular do mandato, abra **WhatsApp → Configurações → Aparelhos conectados → Conectar um aparelho** e leia o QR Code mostrado pela Evolution.

No site, abra `/admin/whatsapp`, clique em **Testar conexão** e confirme que a situação aparece como **Conectado**. Em seguida, clique em **Configurar retornos** para registrar o webhook. Durante todo esse processo, mantenha `EVOLUTION_SEND_ENABLED=false`.

Depois de validar o número, os textos e o recebimento de respostas, altere `EVOLUTION_SEND_ENABLED=true` e configure uma chamada de hora em hora:

```cron
0 * * * *
```

```bash
curl --fail --silent --show-error --max-time 120 \
  --request POST \
  --header "Authorization: Bearer SEU_COMMUNICATIONS_CRON_SECRET" \
  https://juniorcoringa.com.br/api/internal/communications/run
```

A rotina só envia entre 09:00 e 18:59 no fuso de Campo Grande. Respostas `SAIR`, `CANCELAR` ou `PARAR` revogam a autorização e cancelam mensagens pendentes. Nunca publique ou envie por conversa as chaves `EVOLUTION_API_KEY`, `EVOLUTION_WEBHOOK_SECRET` e `COMMUNICATIONS_CRON_SECRET`.

## 7. Faça o deploy

Inicie o deploy. O EasyPanel fará o build da imagem e usará o health check em `/api/health`. Depois que o serviço estiver saudável:

- acesse o domínio para conferir o site;
- abra `/admin`;
- entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`;
- crie a primeira matéria.

## Atualizações

Depois de cada `git push`, faça um novo deploy pelo EasyPanel ou ative o deploy automático do repositório. O volume de `/app/data` deve continuar conectado em todas as versões.
