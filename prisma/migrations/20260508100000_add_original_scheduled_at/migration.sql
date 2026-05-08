ALTER TABLE "Dispatch" ADD COLUMN "originalScheduledAt" TIMESTAMP(3);

UPDATE "Dispatch"
SET "originalScheduledAt" = "scheduledAt"
WHERE "originalScheduledAt" IS NULL;

ALTER TABLE "Dispatch" ALTER COLUMN "originalScheduledAt" SET NOT NULL;

CREATE INDEX "Dispatch_originalScheduledAt_idx" ON "Dispatch"("originalScheduledAt");
