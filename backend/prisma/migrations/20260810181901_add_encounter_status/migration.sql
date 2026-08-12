-- CreateEnum
CREATE TYPE "encounter_status" AS ENUM ('PENDING', 'CAUGHT', 'MISSED');

-- AlterTable: add the new status column derived from the old `caught`
-- boolean before dropping it, so existing rows keep their CAUGHT/PENDING
-- state instead of silently resetting to PENDING.
ALTER TABLE "encounters" ADD COLUMN "status" "encounter_status" NOT NULL DEFAULT 'PENDING';

UPDATE "encounters" SET "status" = 'CAUGHT' WHERE "caught" = true;

ALTER TABLE "encounters" DROP COLUMN "caught";
