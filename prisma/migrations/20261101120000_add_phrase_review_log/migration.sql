-- CreateEnum
CREATE TYPE "PhraseGrade" AS ENUM ('FORGOT', 'HARD', 'EASY');

-- CreateTable
CREATE TABLE "PhraseReview" (
    "id" SERIAL NOT NULL,
    "phraseId" TEXT NOT NULL,
    "grade" "PhraseGrade" NOT NULL,
    "usedHint" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhraseReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhraseReview_phraseId_idx" ON "PhraseReview"("phraseId");

-- CreateIndex
CREATE INDEX "PhraseReview_createdAt_idx" ON "PhraseReview"("createdAt");

-- AddForeignKey
ALTER TABLE "PhraseReview" ADD CONSTRAINT "PhraseReview_phraseId_fkey" FOREIGN KEY ("phraseId") REFERENCES "Phrase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
