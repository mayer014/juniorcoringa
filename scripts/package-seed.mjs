import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";

const projectRoot = process.cwd();
const dataDir = path.resolve(process.env.DATA_DIR || path.join(projectRoot, "data"));
const databasePath = path.join(dataDir, "junior-coringa.sqlite");
const uploadsPath = path.join(dataDir, "uploads");
const seedDir = path.join(projectRoot, "seed");

if (!fs.existsSync(databasePath)) {
  throw new Error(`Banco não encontrado: ${databasePath}`);
}
if (path.dirname(seedDir) !== projectRoot || path.basename(seedDir) !== "seed") {
  throw new Error("Diretório de seed fora do projeto.");
}

const database = new Database(databasePath);
database.pragma("wal_checkpoint(TRUNCATE)");
database.close();

await fsp.rm(seedDir, { recursive: true, force: true });
await fsp.mkdir(path.join(seedDir, "uploads"), { recursive: true });
await fsp.copyFile(databasePath, path.join(seedDir, "junior-coringa.sqlite"));

if (fs.existsSync(uploadsPath)) {
  await fsp.cp(uploadsPath, path.join(seedDir, "uploads"), { recursive: true });
}

const uploadCount = fs.existsSync(path.join(seedDir, "uploads"))
  ? (await fsp.readdir(path.join(seedDir, "uploads"))).length
  : 0;
console.log(`Pacote inicial criado com ${uploadCount} arquivos de mídia.`);
