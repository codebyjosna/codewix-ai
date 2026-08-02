import { Toaster } from "@/components/ui/toaster";
import Header from "@/components/header";

export default function UserLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <body className="flex min-h-full flex-col bg-gray-100 text-gray-900 antialiased">
      <Header />
      {children}
      <Toaster />
    </body>
  );
}
