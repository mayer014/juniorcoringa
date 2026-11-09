const fs = require("node:fs");
const path = require("node:path");

const packageRoot = process.argv[2];
if (!packageRoot) throw new Error("Informe o diretório do pacote Baileys.");

const packageJsonPath = path.join(packageRoot, "package.json");
const targetPath = path.join(packageRoot, "lib", "Socket", "messages-recv.js");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
if (packageJson.version !== "7.0.0-rc.9") {
  throw new Error(`Versão inesperada do Baileys: ${packageJson.version}. Esperada: 7.0.0-rc.9.`);
}

let source = fs.readFileSync(targetPath, "utf8");
const marker = "EVOLUTION_STATUS_ACK_PATCH";
if (source.includes(marker)) {
  console.log("Patch de ACK de status já aplicado.");
  process.exit(0);
}

const processorAnchor = "    const makeOfflineNodeProcessor = () => {";
const mapAnchor = "            ['notification', handleNotification]\n";
const listenerAnchor = [
  "    ws.on('CB:notification', async (node) => {",
  "        await processNode('notification', node, 'handling notification', handleNotification);",
  "    });",
].join("\n");

for (const anchor of [processorAnchor, mapAnchor, listenerAnchor]) {
  if (!source.includes(anchor)) throw new Error(`Estrutura esperada não encontrada: ${anchor}`);
}

source = source.replace(processorAnchor, [
  "    // EVOLUTION_STATUS_ACK_PATCH: confirma stanzas de status para impedir que a sessão fique aberta e surda.",
  "    const handleStatus = async (node) => {",
  "        try {",
  "            await sendMessageAck(node);",
  "        }",
  "        catch (error) {",
  "            onUnexpectedError(error, 'acking status stanza');",
  "        }",
  "    };",
  processorAnchor,
].join("\n"));

source = source.replace(mapAnchor, [
  "            ['notification', handleNotification],",
  "            ['status', handleStatus]",
  "",
].join("\n"));

source = source.replace(listenerAnchor, [
  listenerAnchor,
  "    ws.on('CB:status', async (node) => {",
  "        await processNode('status', node, 'acking status stanza', handleStatus);",
  "    });",
].join("\n"));

if ((source.match(/EVOLUTION_STATUS_ACK_PATCH/g) || []).length !== 1) {
  throw new Error("O marcador do patch não foi aplicado exatamente uma vez.");
}

fs.writeFileSync(targetPath, source);
console.log(`Patch de ACK de status aplicado ao Baileys ${packageJson.version}.`);
