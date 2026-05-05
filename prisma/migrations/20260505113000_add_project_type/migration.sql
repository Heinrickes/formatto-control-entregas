ALTER TABLE "Dispatch" ADD COLUMN "projectType" TEXT NOT NULL DEFAULT 'Edificio';

CREATE INDEX "Dispatch_programId_projectType_idx" ON "Dispatch"("programId", "projectType");
