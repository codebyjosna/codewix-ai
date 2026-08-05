import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUserId } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";

const PAGE_SIZE = 9;

export default async function UserHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;

  const sessionUserId = await getSessionUserId();
  if (!sessionUserId || sessionUserId !== id) {
    redirect("/signin");
  }

  const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const prisma = getPrisma();

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where: { userId: id },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.project.count({ where: { userId: id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Your projects</h1>

      {projects.length === 0 ? (
        <p className="text-gray-500">You don&apos;t have any projects yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={project.chatId ? `/chats/${project.chatId}` : `#`}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-gray-300"
            >
              <h2 className="font-medium">{project.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">{project.description}</p>
              <p className="mt-2 text-xs text-gray-400">
                Updated {project.updatedAt.toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link
            href={`/user/${id}?page=${page - 1}`}
            aria-disabled={page <= 1}
            className={`rounded-lg border border-gray-300 px-3 py-1.5 text-sm ${
              page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-gray-50"
            }`}
          >
            Previous
          </Link>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/user/${id}?page=${page + 1}`}
            aria-disabled={page >= totalPages}
            className={`rounded-lg border border-gray-300 px-3 py-1.5 text-sm ${
              page >= totalPages
                ? "pointer-events-none opacity-40"
                : "hover:bg-gray-50"
            }`}
          >
            Next
          </Link>
        </div>
      )}
    </div>
  );
}
