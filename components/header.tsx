"use client";

import { memo, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

type CurrentUser = { id: string; name: string };

function Header({ variant = "light" }: { variant?: "light" | "dark" }) {
  const isDark = variant === "dark";
  const router = useRouter();

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      setConfirmOpen(false);
      router.push("/");
      router.refresh();
    } catch {
      toast({
        title: "Failed to sign out",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  }

  const pillClassName = isDark
    ? "rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
    : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50";

  return (
    <header className="relative z-10 mx-auto flex w-full shrink-0 items-center justify-between px-4 py-6 sm:px-6">
      <Link href="/" className="flex items-center gap-2">
        <span
          className={`text-2xl font-extrabold tracking-tight ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          CODEWIX
        </span>
      </Link>

      {!loaded ? (
        <div
          className={`h-9 w-24 animate-pulse rounded-xl ${
            isDark ? "bg-white/10" : "bg-gray-200"
          }`}
        />
      ) : user ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger className={`${pillClassName} max-w-40 truncate`}>
            {user.name}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel className="truncate">
              {user.name}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={`/user/${user.id}`} />}>
              My projects
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                toast({
                  title: "Upgrade",
                  description: "Paid plans are coming soon.",
                })
              }
            >
              Upgrade
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 data-[highlighted]:bg-red-50 data-[highlighted]:text-red-600"
              onClick={() => {
                setMenuOpen(false);
                setConfirmOpen(true);
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link href="/signin" className={pillClassName}>
          Sign in
        </Link>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Sign out of Codewix?</AlertDialogTitle>
          <AlertDialogDescription>
            You&apos;ll need to sign in again to access your projects.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? "Signing out..." : "Sign out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </header>
  );
}

export default memo(Header);

