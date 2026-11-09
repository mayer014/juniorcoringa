FROM evoapicloud/evolution-api:v2.3.7

LABEL org.opencontainers.image.description="Evolution API 2.3.7 com correção do ACK de status do Baileys"

COPY patch-status.cjs /tmp/patch-status.cjs

RUN node /tmp/patch-status.cjs /evolution/node_modules/baileys \
    && node --check /evolution/node_modules/baileys/lib/Socket/messages-recv.js \
    && rm /tmp/patch-status.cjs
