import { Toaster } from "@/components/ui/toaster";
import Header from "@/components/header";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <body className="flex min-h-full flex-col bg-gray-100 text-gray-900 antialiased">
      <Header />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        {children}
      </main>
      <Toaster />
    </body>
  );
}
