import { PrismaClient } from "@prisma/client";
import { cache } from "react";

// Use a global singleton in dev to avoid exhausting connections during HMR.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const getPrisma = cache(() => {
  if (globalForPrisma.prisma) return globalForPrisma.prisma;

  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
  }

  return prisma;
});
