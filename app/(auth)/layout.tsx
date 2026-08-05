import { Toaster } from "@/components/ui/toaster";
import Header from "@/components/header";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();

  return (
    <body className="flex min-h-full flex-col bg-gray-100 text-gray-900 antialiased">
      <Header initialUser={user ? { id: user.id, name: user.name } : null} />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        {children}
      </main>
      <Toaster />
    </body>
  );
}
