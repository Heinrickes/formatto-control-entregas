import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const migrationName = "20260505100000_add_production_tracking";
const migrationPath = path.join(process.cwd(), "prisma", "migrations", migrationName, "migration.sql");
const sql = fs.readFileSync(migrationPath, "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");

async function columnExists(columnName) {
  const result = await prisma.$queryRaw`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'control_entregas'
      AND table_name = 'Dispatch'
      AND column_name = ${columnName}
    LIMIT 1
  `;
  return result.length > 0;
}

async function indexExists(indexName) {
  const result = await prisma.$queryRaw`
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'control_entregas'
      AND indexname = ${indexName}
    LIMIT 1
  `;
  return result.length > 0;
}

async function main() {
  if (!(await columnExists("fabricationType"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Dispatch" ADD COLUMN "fabricationType" TEXT NOT NULL DEFAULT 'RTA'`);
  }
  if (!(await columnExists("productionStage"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Dispatch" ADD COLUMN "productionStage" TEXT NOT NULL DEFAULT 'Corte'`);
  }
  if (!(await columnExists("productionStartAt"))) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Dispatch" ADD COLUMN "productionStartAt" TIMESTAMP(3)`);
  }
  if (!(await indexExists("Dispatch_programId_productionStage_idx"))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX "Dispatch_programId_productionStage_idx" ON "Dispatch"("programId", "productionStage")`);
  }
  if (!(await indexExists("Dispatch_productionStartAt_idx"))) {
    await prisma.$executeRawUnsafe(`CREATE INDEX "Dispatch_productionStartAt_idx" ON "Dispatch"("productionStartAt")`);
  }

  const existing = await prisma.$queryRaw`
    SELECT id
    FROM "_prisma_migrations"
    WHERE migration_name = ${migrationName}
    LIMIT 1
  `;
  if (existing.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        (${crypto.randomUUID()}, ${checksum}, NOW(), ${migrationName}, NULL, NULL, NOW(), 1)
    `;
  }

  const counts = await prisma.$queryRawUnsafe(`
    SELECT "fabricationType", "productionStage", COUNT(*)::int AS count
    FROM "Dispatch"
    GROUP BY "fabricationType", "productionStage"
    ORDER BY "fabricationType", "productionStage"
  `);
  console.log(JSON.stringify({ migrationName, applied: true, counts }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
