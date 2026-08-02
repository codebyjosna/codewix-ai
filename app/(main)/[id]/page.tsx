import { redirect } from "next/navigation";
import HomeClient from "../home-client";
import { getCurrentUser } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

// The signed-in homepage: same builder UI as "/", but at a personalized URL.
export default async function UserHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user || user.id !== id) {
    redirect("/");
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
      initialUser={{ id: user.id, name: user.name }}
      stats={{ appCount, userCount }}
      projectTypes={projectTypes}
    />
  );
}

export const maxDuration = 60;
