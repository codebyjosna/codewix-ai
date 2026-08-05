import Header from "@/components/header";
import { getCurrentUser } from "@/lib/auth";

export default async function Page() {
  const user = await getCurrentUser();

  return (
    <body className="flex min-h-full flex-col bg-gray-100 text-gray-900 antialiased">
      <div className="flex grow flex-col">
        <Header initialUser={user ? { id: user.id, name: user.name } : null} />
        <div className="flex grow items-center justify-center">
          <h2 className="text-3xl">404 | Not Found</h2>
        </div>
      </div>
    </body>
  );
}
