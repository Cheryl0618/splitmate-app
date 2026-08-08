import { DatabaseSync } from "node:sqlite";
import { resolve } from "node:path";

function databasePath() {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) {
    throw new Error("SplitMate expects a SQLite file DATABASE_URL");
  }
  return resolve(process.cwd(), url.slice("file:".length));
}

export function openDatabase() {
  return new DatabaseSync(databasePath(), { readOnly: true });
}
