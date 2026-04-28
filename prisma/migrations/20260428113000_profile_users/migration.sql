ALTER TABLE "Profile"
ADD COLUMN "area" TEXT,
ADD COLUMN "position" TEXT,
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Profile_role_idx" ON "Profile"("role");
CREATE INDEX "Profile_active_idx" ON "Profile"("active");
