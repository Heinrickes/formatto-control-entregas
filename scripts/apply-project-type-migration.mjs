import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const migrationName = "20260505113000_add_project_type";
const migrationPath = path.join(process.cwd(), "prisma", "migrations", migrationName, "migration.sql");
const sql = fs.readFileSync(migrationPath, "utf8");
const checksum = crypto.createHash("sha256").update(sql).digest("hex");

async function main() {
  const column = await prisma.$queryRaw`
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'control_entregas'
      AND table_name = 'Dispatch'
      AND column_name = 'projectType'
    LIMIT 1
  `;
  if (column.length === 0) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Dispatch" ADD COLUMN "projectType" TEXT NOT NULL DEFAULT 'Edificio'`);
  }

  const index = await prisma.$queryRaw`
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'control_entregas'
      AND indexname = 'Dispatch_programId_projectType_idx'
    LIMIT 1
  `;
  if (index.length === 0) {
    await prisma.$executeRawUnsafe(`CREATE INDEX "Dispatch_programId_projectType_idx" ON "Dispatch"("programId", "projectType")`);
  }

  const migration = await prisma.$queryRaw`
    SELECT id FROM "_prisma_migrations"
    WHERE migration_name = ${migrationName}
    LIMIT 1
  `;
  if (migration.length === 0) {
    await prisma.$executeRaw`
      INSERT INTO "_prisma_migrations"
        (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
      VALUES
        (${crypto.randomUUID()}, ${checksum}, NOW(), ${migrationName}, NULL, NULL, NOW(), 1)
    `;
  }

  const counts = await prisma.$queryRawUnsafe(`
    SELECT "projectType", COUNT(*)::int AS count
    FROM "Dispatch"
    GROUP BY "projectType"
    ORDER BY "projectType"
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
