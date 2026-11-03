-- CreateTable
CREATE TABLE "StudyList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyList_userId_idx" ON "StudyList"("userId");

-- AddForeignKey
ALTER TABLE "StudyList" ADD CONSTRAINT "StudyList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Study plans written inside a certificate become study lists of their own.
-- The list takes the certificate's id, so the sections need no re-pointing.
INSERT INTO "StudyList" ("id", "userId", "title", "updatedAt")
SELECT c."id", c."userId", c."name", CURRENT_TIMESTAMP
FROM "Certificate" c
WHERE EXISTS (SELECT 1 FROM "CertificateSection" s WHERE s."certificateId" = c."id");

-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN "studyListId" TEXT;

UPDATE "Certificate" c
SET "studyListId" = c."id"
WHERE EXISTS (SELECT 1 FROM "CertificateSection" s WHERE s."certificateId" = c."id");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_studyListId_fkey" FOREIGN KEY ("studyListId") REFERENCES "StudyList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CertificateSection -> StudySection
ALTER TABLE "CertificateSection" DROP CONSTRAINT "CertificateSection_certificateId_fkey";
ALTER TABLE "CertificateSection" RENAME TO "StudySection";
ALTER TABLE "StudySection" RENAME COLUMN "certificateId" TO "studyListId";
ALTER TABLE "StudySection" RENAME CONSTRAINT "CertificateSection_pkey" TO "StudySection_pkey";
ALTER INDEX "CertificateSection_certificateId_order_idx" RENAME TO "StudySection_studyListId_order_idx";
ALTER TABLE "StudySection" ADD CONSTRAINT "StudySection_studyListId_fkey" FOREIGN KEY ("studyListId") REFERENCES "StudyList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CertificateStep -> StudyStep
ALTER TABLE "CertificateStep" RENAME TO "StudyStep";
ALTER TABLE "StudyStep" RENAME CONSTRAINT "CertificateStep_pkey" TO "StudyStep_pkey";
ALTER TABLE "StudyStep" RENAME CONSTRAINT "CertificateStep_sectionId_fkey" TO "StudyStep_sectionId_fkey";
ALTER INDEX "CertificateStep_sectionId_order_idx" RENAME TO "StudyStep_sectionId_order_idx";
