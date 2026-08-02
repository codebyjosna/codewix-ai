-- CreateTable: project_types (dropdown source for the project-creation dialog)
CREATE TABLE "public"."project_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_types_name_key" ON "public"."project_types"("name");
CREATE UNIQUE INDEX "project_types_slug_key" ON "public"."project_types"("slug");

-- CreateTable: project_visibilities (dropdown source for the project-creation dialog)
CREATE TABLE "public"."project_visibilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_visibilities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_visibilities_name_key" ON "public"."project_visibilities"("name");
CREATE UNIQUE INDEX "project_visibilities_slug_key" ON "public"."project_visibilities"("slug");

-- Seed project types (managed via this table only - never hardcoded in app code)
INSERT INTO "public"."project_types" ("name", "slug", "sort_order") VALUES
  ('Website', 'website', 1),
  ('Web Application', 'web-application', 2),
  ('Landing Page', 'landing-page', 3),
  ('Portfolio', 'portfolio', 4),
  ('E-commerce Store', 'ecommerce-store', 5),
  ('Blog', 'blog', 6),
  ('Dashboard / Admin Panel', 'dashboard-admin-panel', 7),
  ('Android Application', 'android-application', 8),
  ('iOS Application', 'ios-application', 9),
  ('Chrome Extension', 'chrome-extension', 10),
  ('API / Backend Service', 'api-backend-service', 11),
  ('Game', 'game', 12);

-- Seed visibility options
INSERT INTO "public"."project_visibilities" ("name", "slug", "sort_order") VALUES
  ('Public', 'public', 1),
  ('Private', 'private', 2);

-- Sequence backing the 7-digit sequential suffix of the CWAI<MMYY><seq> project id.
-- Continues forever (never reset), per spec: "must always continue from the latest existing project".
CREATE SEQUENCE IF NOT EXISTS "public"."project_id_seq" START WITH 1 INCREMENT BY 1;

-- Project ids are now app-generated (CWAI+MMYY+7-digit sequence) instead of DB-default uuids.
-- Table has 0 rows in every known environment, so this is a safe in-place type change.
ALTER TABLE "public"."projects" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "public"."projects" ALTER COLUMN "id" SET DATA TYPE TEXT;

-- AlterTable: add new required project-creation-dialog columns
ALTER TABLE "public"."projects"
  ADD COLUMN "description" TEXT NOT NULL,
  ADD COLUMN "project_type_id" UUID NOT NULL,
  ADD COLUMN "visibility_id" UUID NOT NULL,
  ADD COLUMN "chat_id" TEXT;

ALTER TABLE "public"."projects"
  ADD CONSTRAINT "projects_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "public"."project_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "projects_visibility_id_fkey" FOREIGN KEY ("visibility_id") REFERENCES "public"."project_visibilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "projects_project_type_id_idx" ON "public"."projects"("project_type_id");
CREATE INDEX "projects_visibility_id_idx" ON "public"."projects"("visibility_id");

-- Enable RLS on the new lookup tables, matching the existing
-- 20260802020000_enable_rls migration's convention: no policies are added,
-- so Supabase's PostgREST anon/authenticated roles get zero access. The app
-- connects as the table owner (postgres), which bypasses RLS entirely, so
-- this has no effect on Prisma access - it's defense-in-depth only.
ALTER TABLE "public"."project_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."project_visibilities" ENABLE ROW LEVEL SECURITY;
