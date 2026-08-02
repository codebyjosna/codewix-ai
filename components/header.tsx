"use client";

import { memo, useState, useTransition } from "react";
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
import { useCurrentUser, type CurrentUser } from "@/hooks/use-current-user";

function Header({
  variant = "light",
  initialUser,
}: {
  variant?: "light" | "dark";
  initialUser?: CurrentUser | null;
}) {
  const isDark = variant === "dark";
  const router = useRouter();

  const { user, loaded, setUser } = useCurrentUser(initialUser);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isNavigatingHome, startNavigateHome] = useTransition();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      // Reflect signed-out state immediately; don't wait on navigation.
      setUser(null);
      setConfirmOpen(false);
      startNavigateHome(() => {
        router.push("/");
        router.refresh();
      });
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

  const isBusy = signingOut || isNavigatingHome;

  return (
    <header className="relative z-10 mx-auto flex w-full shrink-0 items-center justify-between px-4 py-6 sm:px-6">
      <Link href={user ? `/${user.id}` : "/"} className="flex items-center gap-2">
        <span
          className={`text-2xl font-extrabold tracking-tight ${
            isDark ? "text-white" : "text-gray-900"
          }`}
        >
          CODEWIX
        </span>
      </Link>

      {!loaded || isBusy ? (
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

