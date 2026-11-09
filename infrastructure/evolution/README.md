# Evolution API 2.3.7 com correção de recebimento

Esta imagem deriva diretamente de `evoapicloud/evolution-api:v2.3.7` e aplica somente o ACK de stanzas `status` no Baileys `7.0.0-rc.9`.

O patch evita o estado em que a instância continua `open`, mas deixa de salvar mensagens recebidas e de emitir `MESSAGES_UPSERT`. O build falha deliberadamente se a versão do Baileys ou os pontos de inserção forem diferentes dos esperados.

No EasyPanel, use o repositório do site como fonte, contexto na raiz e o Dockerfile:

```text
infrastructure/evolution/Dockerfile
```

Para reverter, restaure a fonte para:

```text
evoapicloud/evolution-api:v2.3.7
```
