-- CreateTable
CREATE TABLE "UserAccessSecret" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "profileEmail" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "passwordCipher" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "sentByEmail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAccessSecret_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserAccessSecret_profileId_idx" ON "UserAccessSecret"("profileId");

-- CreateIndex
CREATE INDEX "UserAccessSecret_profileEmail_idx" ON "UserAccessSecret"("profileEmail");

-- CreateIndex
CREATE INDEX "UserAccessSecret_createdAt_idx" ON "UserAccessSecret"("createdAt");

-- AddForeignKey
ALTER TABLE "UserAccessSecret" ADD CONSTRAINT "UserAccessSecret_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
