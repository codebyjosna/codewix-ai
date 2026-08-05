
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "codewix_ai";

-- CreateTable
CREATE TABLE "codewix_ai"."GeneratedApp" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedApp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codewix_ai"."Chat" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "braintrustParent" TEXT,
    "llamaCoderVersion" TEXT NOT NULL DEFAULT 'v2',
    "shadcn" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "codewix_ai"."Message" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "files" JSONB,
    "chatId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedApp_id_idx" ON "codewix_ai"."GeneratedApp"("id");

-- CreateIndex
CREATE INDEX "Chat_createdAt_idx" ON "codewix_ai"."Chat"("createdAt");

-- CreateIndex
CREATE INDEX "Message_chatId_idx" ON "codewix_ai"."Message"("chatId");

-- CreateIndex
CREATE INDEX "Message_chatId_createdAt_idx" ON "codewix_ai"."Message"("chatId", "createdAt");

-- AddForeignKey
ALTER TABLE "codewix_ai"."Message" ADD CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "codewix_ai"."Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

