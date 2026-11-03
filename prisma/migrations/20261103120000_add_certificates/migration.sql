-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('ACHIEVED', 'STUDYING', 'PLANNED');

-- CreateTable
CREATE TABLE "Certificate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "status" "CertificateStatus" NOT NULL,
    "imageUrl" TEXT,
    "credentialId" TEXT,
    "verifyUrl" TEXT,
    "score" TEXT,
    "issuedAt" DATE,
    "expiresAt" DATE,
    "startDate" DATE,
    "targetDate" DATE,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateSection" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "CertificateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateStep" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "url" TEXT,
    "isDone" BOOLEAN NOT NULL DEFAULT false,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "CertificateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificateResource" (
    "id" TEXT NOT NULL,
    "certificateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificateResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Certificate_userId_status_idx" ON "Certificate"("userId", "status");

-- CreateIndex
CREATE INDEX "CertificateSection_certificateId_order_idx" ON "CertificateSection"("certificateId", "order");

-- CreateIndex
CREATE INDEX "CertificateStep_sectionId_order_idx" ON "CertificateStep"("sectionId", "order");

-- CreateIndex
CREATE INDEX "CertificateResource_certificateId_idx" ON "CertificateResource"("certificateId");

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateSection" ADD CONSTRAINT "CertificateSection_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateStep" ADD CONSTRAINT "CertificateStep_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CertificateSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificateResource" ADD CONSTRAINT "CertificateResource_certificateId_fkey" FOREIGN KEY ("certificateId") REFERENCES "Certificate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
