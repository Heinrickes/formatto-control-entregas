-- AlterEnum
ALTER TYPE "DispatchState" ADD VALUE 'parcial';

-- AlterTable
ALTER TABLE "Dispatch" ADD COLUMN     "parentDispatchId" TEXT;

-- CreateIndex
CREATE INDEX "Dispatch_parentDispatchId_idx" ON "Dispatch"("parentDispatchId");

-- AddForeignKey
ALTER TABLE "Dispatch" ADD CONSTRAINT "Dispatch_parentDispatchId_fkey" FOREIGN KEY ("parentDispatchId") REFERENCES "Dispatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
