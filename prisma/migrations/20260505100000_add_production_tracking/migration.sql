ALTER TABLE "Dispatch" ADD COLUMN "fabricationType" TEXT NOT NULL DEFAULT 'RTA';
ALTER TABLE "Dispatch" ADD COLUMN "productionStage" TEXT NOT NULL DEFAULT 'Corte';
ALTER TABLE "Dispatch" ADD COLUMN "productionStartAt" TIMESTAMP(3);

CREATE INDEX "Dispatch_programId_productionStage_idx" ON "Dispatch"("programId", "productionStage");
CREATE INDEX "Dispatch_productionStartAt_idx" ON "Dispatch"("productionStartAt");
