-- CreateEnum
CREATE TYPE "PhraseStage" AS ENUM ('WRITE', 'RECALL', 'SPEAK', 'MASTERED');

-- CreateEnum
CREATE TYPE "PhraseExampleStep" AS ENUM ('WRITE', 'RECALL');

-- CreateTable
CREATE TABLE "Phrase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" INTEGER,
    "phrase" TEXT NOT NULL,
    "phraseNormalized" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "sampleSentence" TEXT,
    "stage" "PhraseStage" NOT NULL DEFAULT 'WRITE',
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt" DATE NOT NULL,
    "easyStreak" INTEGER NOT NULL DEFAULT 0,
    "speakPassed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Phrase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhraseExample" (
    "id" SERIAL NOT NULL,
    "phraseId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "step" "PhraseExampleStep" NOT NULL,
    "isCorrect" BOOLEAN,
    "feedback" TEXT,
    "usedHint" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhraseExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhraseSpokenAttempt" (
    "id" SERIAL NOT NULL,
    "phraseId" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "containsPhrase" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhraseSpokenAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhraseActivityDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "PhraseActivityDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "Phrase_userId_stage_nextReviewAt_idx" ON "Phrase"("userId", "stage", "nextReviewAt");

-- CreateIndex
CREATE UNIQUE INDEX "Phrase_userId_phraseNormalized_key" ON "Phrase"("userId", "phraseNormalized");

-- CreateIndex
CREATE INDEX "PhraseExample_phraseId_idx" ON "PhraseExample"("phraseId");

-- CreateIndex
CREATE INDEX "PhraseSpokenAttempt_phraseId_idx" ON "PhraseSpokenAttempt"("phraseId");

-- AddForeignKey
ALTER TABLE "Phrase" ADD CONSTRAINT "Phrase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phrase" ADD CONSTRAINT "Phrase_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhraseExample" ADD CONSTRAINT "PhraseExample_phraseId_fkey" FOREIGN KEY ("phraseId") REFERENCES "Phrase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhraseSpokenAttempt" ADD CONSTRAINT "PhraseSpokenAttempt_phraseId_fkey" FOREIGN KEY ("phraseId") REFERENCES "Phrase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhraseActivityDay" ADD CONSTRAINT "PhraseActivityDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
