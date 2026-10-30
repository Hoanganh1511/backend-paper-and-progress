-- CreateEnum
CREATE TYPE "CriteriaStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "CriteriaPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('ON_TRACK', 'AT_RISK', 'NEEDS_ATTENTION');

-- CreateTable
CREATE TABLE "ProjectConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "health" "ProjectHealth" NOT NULL DEFAULT 'ON_TRACK',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CriteriaCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CriteriaCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectCriteria" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "CriteriaStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "priority" "CriteriaPriority" NOT NULL DEFAULT 'MEDIUM',
    "deadline" TIMESTAMP(3),
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "needsDiscussion" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "evidenceUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL,
    "criteriaId" TEXT,
    "categoryId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CriteriaCategory_sortOrder_idx" ON "CriteriaCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "ProjectCriteria_categoryId_idx" ON "ProjectCriteria"("categoryId");

-- CreateIndex
CREATE INDEX "ProjectCriteria_status_idx" ON "ProjectCriteria"("status");

-- CreateIndex
CREATE INDEX "ProjectCriteria_deadline_idx" ON "ProjectCriteria"("deadline");

-- CreateIndex
CREATE INDEX "ProjectActivity_createdAt_idx" ON "ProjectActivity"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectActivity_criteriaId_idx" ON "ProjectActivity"("criteriaId");

-- CreateIndex
CREATE INDEX "ProjectActivity_type_idx" ON "ProjectActivity"("type");

-- AddForeignKey
ALTER TABLE "ProjectCriteria" ADD CONSTRAINT "ProjectCriteria_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CriteriaCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "ProjectCriteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
