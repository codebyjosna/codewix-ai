import "server-only";
import { getPrisma } from "@/lib/prisma";

// Project ids are CWAI + MMYY + a 7-digit sequential number, e.g.
// CWAI08260000199. The sequence comes from a Postgres sequence
// (public.project_id_seq), so concurrent creates can never collide and the
// number always continues from the latest existing project - never reset,
// never derived from a racy MAX(id)+1 query.
export async function generateProjectId(): Promise<string> {
  const prisma = getPrisma();
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);

  const rows = await prisma.$queryRaw<
    { nextval: bigint }[]
  >`SELECT nextval('public.project_id_seq')`;
  const sequence = rows[0].nextval.toString().padStart(7, "0");

  return `CWAI${mm}${yy}${sequence}`;
}
