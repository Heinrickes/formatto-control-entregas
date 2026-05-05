import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function dateOnly(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

async function main() {
  let dispatches = [];
  try {
    const program = await prisma.program.findFirst({
      where: { active: true },
      include: { dispatches: { orderBy: [{ businessLine: "asc" }, { project: "asc" }, { scheduledAt: "asc" }, { type: "asc" }] } }
    });
    if (program) dispatches = program.dispatches;
  } catch {
    const response = await fetch("http://localhost:3000/api/dashboard");
    if (!response.ok) throw new Error(`No se pudo leer dashboard local: ${response.status}`);
    const data = await response.json();
    dispatches = data.dispatches ?? [];
  }
  if (dispatches.length === 0) throw new Error("No hay tareas para exportar.");

  const rows = dispatches
    .slice()
    .sort((a, b) => `${a.businessLine}-${a.project}-${a.scheduledAt}-${a.type}`.localeCompare(`${b.businessLine}-${b.project}-${b.scheduledAt}-${b.type}`))
    .map((dispatch) => ({
    ID: dispatch.id,
    Periodo: dateOnly(dispatch.scheduledAt).slice(0, 7),
    "Linea Negocio": dispatch.businessLine,
    Proyecto: dispatch.project,
    "Tipo Proyecto": dispatch.projectType ?? "Edificio",
    "Fecha Despacho": dateOnly(dispatch.scheduledAt),
    Tipo: dispatch.type,
    Descripcion: dispatch.description ?? "",
    Torre: dispatch.tower ?? "",
    Nucleo: dispatch.core ?? "",
    Piso: dispatch.floor ?? "",
    Fabricacion: dispatch.fabricationType,
    "Estado Produccion": dispatch.productionStage,
    "Fecha Ingreso Produccion": dateOnly(dispatch.productionStartAt),
    "Deptos/Casas": dispatch.units,
    Observacion: dispatch.detail ?? ""
  }));

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 38 },
    { wch: 10 },
    { wch: 18 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 46 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 22 },
    { wch: 12 },
    { wch: 42 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Carga Ajuste");

  const guide = XLSX.utils.aoa_to_sheet([
    ["Uso"],
    ["Edita los campos operativos y vuelve a importar este archivo desde el boton de carga del tablero."],
    ["No modifiques ID si quieres actualizar una tarea existente. Si dejas ID vacio, la app creara una tarea nueva."],
    [""],
    ["Valores Fabricacion", "RTA", "ARMADO"],
    ["Valores Estado Produccion", "Corte", "Enchape", "Perforado", "Consolidado", "Embalaje", "Armado", "CD"],
    ["Formato fechas", "AAAA-MM-DD"]
  ]);
  guide["!cols"] = [{ wch: 28 }, { wch: 24 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(workbook, guide, "Guia");

  const outputDir = path.join(process.cwd(), "docs");
  fs.mkdirSync(outputDir, { recursive: true });
  let outputPath = path.join(outputDir, "carga-ajuste-realidad-entregas.xlsx");
  if (fs.existsSync(outputPath)) {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
    outputPath = path.join(outputDir, `carga-ajuste-realidad-entregas-${stamp}.xlsx`);
  }
  XLSX.writeFile(workbook, outputPath);

  console.log(JSON.stringify({ outputPath, rows: rows.length }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
