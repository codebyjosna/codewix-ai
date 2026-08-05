-- Enable Row Level Security on public-schema tables so Supabase's
-- PostgREST anon/authenticated roles cannot read or write them.
-- The app connects as the table owner (postgres), which bypasses RLS,
-- so this has no effect on Prisma access.
ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."otp_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."chat_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
