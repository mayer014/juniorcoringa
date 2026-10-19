import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const appRoot = process.cwd();
const dataDir = path.resolve(process.env.DATA_DIR || path.join(appRoot, "data"));
const seedDir = path.join(appRoot, "seed");
const targetDatabase = path.join(dataDir, "junior-coringa.sqlite");
const seedDatabase = path.join(seedDir, "junior-coringa.sqlite");

await fsp.mkdir(dataDir, { recursive: true });

if (!fs.existsSync(targetDatabase) && fs.existsSync(seedDatabase)) {
  await fsp.copyFile(seedDatabase, targetDatabase);
  const seedUploads = path.join(seedDir, "uploads");
  const targetUploads = path.join(dataDir, "uploads");
  if (fs.existsSync(seedUploads)) {
    await fsp.mkdir(targetUploads, { recursive: true });
    for (const filename of await fsp.readdir(seedUploads)) {
      const destination = path.join(targetUploads, filename);
      if (!fs.existsSync(destination)) {
        await fsp.copyFile(path.join(seedUploads, filename), destination);
      }
    }
  }
  console.log("Conteúdo inicial do mandato instalado no volume persistente.");
} else {
  console.log("Volume já inicializado; conteúdo existente preservado.");
}
