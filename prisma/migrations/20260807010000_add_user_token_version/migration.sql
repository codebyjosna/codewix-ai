-- Add tokenVersion column to users table.
-- Embedded in the session JWT so that bumping it (on password reset)
-- invalidates all existing sessions for the user. Defaults to 0 so all
-- existing users start at version 0 and current sessions remain valid.
ALTER TABLE "public"."users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
