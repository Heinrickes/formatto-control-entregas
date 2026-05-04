ALTER TABLE "Dispatch" ADD COLUMN "businessLine" TEXT NOT NULL DEFAULT 'Constructora';

CREATE INDEX "Dispatch_programId_businessLine_idx" ON "Dispatch"("programId", "businessLine");
