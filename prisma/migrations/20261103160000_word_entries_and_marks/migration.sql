-- CreateEnum
CREATE TYPE "WordEntryKind" AS ENUM ('SENTENCE', 'COLLOCATION', 'RELATED');

-- CreateEnum
CREATE TYPE "WordMarkType" AS ENUM ('KNOWN', 'REVIEW');

-- WordSentence -> WordEntry (what was written so far are all sentences)
ALTER TABLE "WordSentence" RENAME TO "WordEntry";
ALTER TABLE "WordEntry" RENAME CONSTRAINT "WordSentence_pkey" TO "WordEntry_pkey";
ALTER TABLE "WordEntry" RENAME CONSTRAINT "WordSentence_userId_fkey" TO "WordEntry_userId_fkey";
ALTER TABLE "WordEntry" RENAME CONSTRAINT "WordSentence_lessonId_fkey" TO "WordEntry_lessonId_fkey";
ALTER TABLE "WordEntry" RENAME CONSTRAINT "WordSentence_wordId_fkey" TO "WordEntry_wordId_fkey";
ALTER INDEX "WordSentence_userId_lessonId_idx" RENAME TO "WordEntry_userId_lessonId_idx";
ALTER SEQUENCE "WordSentence_id_seq" RENAME TO "WordEntry_id_seq";
ALTER TABLE "WordEntry" ADD COLUMN "kind" "WordEntryKind" NOT NULL DEFAULT 'SENTENCE';

-- CreateTable
CREATE TABLE "WordMark" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "wordId" INTEGER NOT NULL,
    "mark" "WordMarkType" NOT NULL,

    CONSTRAINT "WordMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WordMark_userId_lessonId_wordId_key" ON "WordMark"("userId", "lessonId", "wordId");

-- AddForeignKey
ALTER TABLE "WordMark" ADD CONSTRAINT "WordMark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordMark" ADD CONSTRAINT "WordMark_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "DailyLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordMark" ADD CONSTRAINT "WordMark_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
