-- CreateTable
CREATE TABLE "DevTodo" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "category" TEXT NOT NULL DEFAULT 'Backend',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DevTodo_pkey" PRIMARY KEY ("id")
);
