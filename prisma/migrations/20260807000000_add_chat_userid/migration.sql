-- Add userId column to Chat table (codewix_ai schema) so ownership can be
-- checked directly without joining through Project.
-- Nullable for backward compat with chats that have no associated Project.

ALTER TABLE "codewix_ai"."Chat" ADD COLUMN "userId" TEXT;

-- Backfill: set Chat.userId from the Project that links to this chat.
UPDATE "codewix_ai"."Chat" AS c
SET "userId" = p."user_id"
FROM "public"."projects" AS p
WHERE p."chat_id" = c."id" AND p."user_id" IS NOT NULL;

-- Index for ownership lookups (userId = ?)
CREATE INDEX "Chat_userId_idx" ON "codewix_ai"."Chat"("userId");
