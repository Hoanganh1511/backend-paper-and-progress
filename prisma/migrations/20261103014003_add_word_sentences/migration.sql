/*
  Warnings:

  - You are about to drop the column `searchVector` on the `Article` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Article_searchVector_idx";

-- AlterTable
ALTER TABLE "Article" DROP COLUMN "searchVector";
