import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

// Dropdown options for the project-creation dialog. Always read from the
// database - never hardcoded - so admins can add/retire types or visibility
// options without a code change.
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in required" },
      { status: 401 },
    );
  }

  const prisma = getPrisma();
  const [types, visibilities] = await Promise.all([
    prisma.projectType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
    prisma.projectVisibility.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return NextResponse.json({ types, visibilities });
}
