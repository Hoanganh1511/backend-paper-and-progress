-- CreateTable
CREATE TABLE "WordSentence" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "wordId" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordSentence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WordSentence_userId_lessonId_idx" ON "WordSentence"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "WordSentence" ADD CONSTRAINT "WordSentence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordSentence" ADD CONSTRAINT "WordSentence_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "DailyLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordSentence" ADD CONSTRAINT "WordSentence_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
