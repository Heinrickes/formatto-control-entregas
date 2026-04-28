CREATE TYPE "ReportDeliveryStatus" AS ENUM ('enviado', 'error');

CREATE TABLE "ReportDelivery" (
    "id" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderId" TEXT,
    "recipients" TEXT[],
    "projects" TEXT[],
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "status" "ReportDeliveryStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReportDelivery_reportDate_idx" ON "ReportDelivery"("reportDate");
CREATE INDEX "ReportDelivery_createdAt_idx" ON "ReportDelivery"("createdAt");
CREATE INDEX "ReportDelivery_status_idx" ON "ReportDelivery"("status");

ALTER TABLE "ReportDelivery" ADD CONSTRAINT "ReportDelivery_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
