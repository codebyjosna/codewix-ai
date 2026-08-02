import { redirect } from "next/navigation";
import HomeClient from "./home-client";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

export default async function Home() {
  const user = await getCurrentUser();

  // Signed-in users always live at /<uuid>; keep "/" as the guest landing page.
  if (user) {
    redirect(`/${user.id}`);
  }

  const prisma = getPrisma();
  const [appCount, userCount, projectTypes] = await Promise.all([
    prisma.chat.count(),
    prisma.user.count(),
    prisma.projectType.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return (
    <HomeClient
      initialUser={null}
      stats={{ appCount, userCount }}
      projectTypes={projectTypes}
    />
  );
}

// Note: this page now reads the session via Prisma (getCurrentUser), which
// needs Node's TCP driver and can't run on the Edge runtime.
export const maxDuration = 60;
