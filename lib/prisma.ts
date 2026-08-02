import { PrismaClient } from "@prisma/client";
import { cache } from "react";

// Always cache a single PrismaClient on globalThis, in every environment.
// Serverless/Lambda containers reuse their module scope across warm
// invocations - without this, every request opened a brand-new client (and
// connection pool) that was never closed, exhausting the Supabase pooler's
// session-mode client limit within minutes under real traffic.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const getPrisma = cache(() => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

  globalForPrisma.prisma = prisma;

  return prisma;
});
