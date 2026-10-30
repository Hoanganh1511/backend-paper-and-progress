-- CreateEnum
CREATE TYPE "VocabSection" AS ENUM ('TOPIC_CONTRAST', 'PHRASAL_VERB', 'PHRASE_COLLOCATION', 'WORD_PATTERN', 'WORD_FORMATION');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('NEW', 'REVIEW', 'FINAL_TEST');

-- CreateTable
CREATE TABLE "VocabularyUnit" (
    "id" SERIAL NOT NULL,
    "unitNumber" INTEGER NOT NULL,
    "topic" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabularyUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VocabularyWord" (
    "id" SERIAL NOT NULL,
    "unitId" INTEGER NOT NULL,
    "section" "VocabSection" NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "example" TEXT,
    "contrast" TEXT,
    "forms" TEXT,
    "pattern" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VocabularyWord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyLesson" (
    "id" SERIAL NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "type" "LessonType" NOT NULL,
    "unitIds" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserDailyProgress" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" INTEGER NOT NULL,
    "learnCompleted" BOOLEAN NOT NULL DEFAULT false,
    "practiceCompleted" BOOLEAN NOT NULL DEFAULT false,
    "testCompleted" BOOLEAN NOT NULL DEFAULT false,
    "testScore" INTEGER,
    "bestScore" INTEGER,
    "gateUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDailyProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WordReview" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VocabularyUnit_unitNumber_key" ON "VocabularyUnit"("unitNumber");

-- CreateIndex
CREATE INDEX "VocabularyWord_unitId_section_idx" ON "VocabularyWord"("unitId", "section");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLesson_dayNumber_key" ON "DailyLesson"("dayNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DailyLesson_date_key" ON "DailyLesson"("date");

-- CreateIndex
CREATE UNIQUE INDEX "UserDailyProgress_userId_lessonId_key" ON "UserDailyProgress"("userId", "lessonId");

-- CreateIndex
CREATE INDEX "WordReview_userId_wordId_idx" ON "WordReview"("userId", "wordId");

-- AddForeignKey
ALTER TABLE "VocabularyWord" ADD CONSTRAINT "VocabularyWord_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "VocabularyUnit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDailyProgress" ADD CONSTRAINT "UserDailyProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserDailyProgress" ADD CONSTRAINT "UserDailyProgress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "DailyLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordReview" ADD CONSTRAINT "WordReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WordReview" ADD CONSTRAINT "WordReview_wordId_fkey" FOREIGN KEY ("wordId") REFERENCES "VocabularyWord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
