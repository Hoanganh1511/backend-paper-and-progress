-- AlterTable
ALTER TABLE "StudyStep" ADD COLUMN "articleId" TEXT;

-- CreateIndex
CREATE INDEX "StudyStep_articleId_idx" ON "StudyStep"("articleId");

-- AddForeignKey
ALTER TABLE "StudyStep" ADD CONSTRAINT "StudyStep_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE SET NULL ON UPDATE CASCADE;
