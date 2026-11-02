-- CreateEnum
CREATE TYPE "MembershipPlan" AS ENUM ('MONTH', 'YEAR');

-- CreateEnum
CREATE TYPE "MembershipOrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "MembershipOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "MembershipPlan" NOT NULL,
    "months" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "MembershipOrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "MembershipOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MembershipOrder_code_key" ON "MembershipOrder"("code");

-- CreateIndex
CREATE INDEX "MembershipOrder_userId_status_idx" ON "MembershipOrder"("userId", "status");

-- CreateIndex
CREATE INDEX "MembershipOrder_status_createdAt_idx" ON "MembershipOrder"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MembershipOrder" ADD CONSTRAINT "MembershipOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
