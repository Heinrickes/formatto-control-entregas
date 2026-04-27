import fs from "node:fs";
import vm from "node:vm";
import { PrismaClient } from "@prisma/client";

const sourcePath = process.argv[2] ?? "G:\\Mi unidad\\Formatto_Control_de_Entregas.html";
const prisma = new PrismaClient();

function extractConst(source, name) {
  const start = source.indexOf(`const ${name} =`);
  if (start < 0) throw new Error(`No se encontro const ${name}`);
  const afterEquals = source.indexOf("=", start) + 1;
  let depth = 0;
  let inString = null;
  for (let i = afterEquals; i < source.length; i++) {
    const char = source[i];
    const prev = source[i - 1];
    if (inString) {
      if (char === inString && prev !== "\\") inString = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      inString = char;
      continue;
    }
    if (char === "[" || char === "{") depth++;
    if (char === "]" || char === "}") depth--;
    if (depth === 0 && char === ";") return source.slice(afterEquals, i);
  }
  throw new Error(`No se pudo extraer ${name}`);
}

function toDateOnly(date) {
  if (!date) return null;
  const value = date instanceof Date ? date : new Date(date);
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

async function main() {
  const html = fs.readFileSync(sourcePath, "utf8");
  const rowsExpr = extractConst(html, "ROWS");
  const stateExpr = extractConst(html, "ESTADO_EXCEL");
  const context = {};
  vm.createContext(context);
  const rows = vm.runInContext(rowsExpr, context);
  const state = vm.runInContext(`(${stateExpr})`, context);

  await prisma.$transaction(async (tx) => {
    await tx.program.updateMany({ data: { active: false } });
    const program = await tx.program.create({
      data: {
        name: "Programa migrado desde HTML",
        builder: "Formatto",
        startsAt: toDateOnly(rows.reduce((min, row) => (row.fecha < min ? row.fecha : min), rows[0].fecha)),
        endsAt: toDateOnly(rows.reduce((max, row) => (row.fecha > max ? row.fecha : max), rows[0].fecha)),
        active: true
      }
    });

    for (const [index, row] of rows.entries()) {
      const created = await tx.dispatch.create({
        data: {
          programId: program.id,
          legacyId: row.id,
          project: row.proj,
          type: row.tipo,
          detail: row.info || null,
          units: Number(row.dep || 0),
          scheduledAt: toDateOnly(row.fecha),
          source: row.fuente === "excel" ? "excel" : "programa",
          sortOrder: index,
          status: {
            create: {
              state: state[row.id]?.estado ?? "pendiente",
              actualAt: toDateOnly(state[row.id]?.fechaReal),
              notes: state[row.id]?.notas ?? null,
              updatedBy: "migration"
            }
          }
        }
      });

      if (state[row.id]) {
        await tx.dispatchEvent.create({
          data: {
            dispatchId: created.id,
            state: state[row.id].estado ?? "pendiente",
            actualAt: toDateOnly(state[row.id].fechaReal),
            notes: state[row.id].notas ?? "Migrado desde HTML"
          }
        });
      }
    }
  });

  console.log(`Migrados ${rows.length} despachos desde ${sourcePath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
