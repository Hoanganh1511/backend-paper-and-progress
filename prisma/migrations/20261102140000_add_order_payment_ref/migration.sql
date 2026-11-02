-- AlterTable
ALTER TABLE "MembershipOrder" ADD COLUMN     "paymentRef" TEXT,
ADD COLUMN     "receivedAmount" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "MembershipOrder_paymentRef_key" ON "MembershipOrder"("paymentRef");
