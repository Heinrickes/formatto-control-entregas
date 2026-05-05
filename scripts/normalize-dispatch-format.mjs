import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function toTitleText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/(^|[\s/.-])([\p{L}\p{N}])/gu, (_, separator, character) => `${separator}${character.toUpperCase()}`)
    .replace(/\bS\.a\b/g, "S.A")
    .replace(/\bSpa\b/g, "SpA");
}

function normalizeProjectName(value) {
  const clean = toTitleText(value);
  const upper = clean.toUpperCase();
  if (upper === "LOS SAUCES" || upper === "EL SAUCE") return "El Sauce";
  return clean;
}

function cleanLocationValue(value, label) {
  if (!value) return null;
  const prefixes = {
    torre: /^torre\s*/i,
    nucleo: /^(n[uú]cleo|nuclo)\s*/i,
    piso: /^piso\s*/i
  };
  const clean = toTitleText(String(value).replace(prefixes[label], ""));
  return clean || null;
}

async function main() {
  const rows = await prisma.dispatch.findMany({
    select: { id: true, businessLine: true, project: true, tower: true, core: true, floor: true }
  });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = path.join(process.cwd(), "backups", `dispatch-format-before-normalize-${stamp}.json`);
  fs.mkdirSync(path.dirname(backupFile), { recursive: true });
  fs.writeFileSync(backupFile, JSON.stringify(rows, null, 2));

  let changed = 0;
  const examples = [];
  for (const row of rows) {
    const next = {
      project: normalizeProjectName(row.project),
      tower: cleanLocationValue(row.tower, "torre"),
      core: cleanLocationValue(row.core, "nucleo"),
      floor: cleanLocationValue(row.floor, "piso")
    };
    if (next.project !== row.project || next.tower !== row.tower || next.core !== row.core || next.floor !== row.floor) {
      changed++;
      if (examples.length < 12) examples.push({ before: row, after: next });
      await prisma.dispatch.update({ where: { id: row.id }, data: next });
    }
  }

  const projects = await prisma.dispatch.groupBy({
    by: ["businessLine", "project"],
    _count: { _all: true },
    orderBy: [{ businessLine: "asc" }, { project: "asc" }]
  });
  console.log(JSON.stringify({ backupFile, total: rows.length, changed, examples, projects }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
