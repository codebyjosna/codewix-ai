"use client";

import { memo, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Menu, X } from "lucide-react";

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
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "#features", sectionId: "features" },
  { label: "Templates", href: "#templates", sectionId: "templates" },
  { label: "Showcase", href: "#showcase", sectionId: "showcase" },
  { label: "Pricing", href: "/pricing" },
  { label: "Docs", href: "/docs" },
  { label: "Blog", href: "/blog" },
] as const;

const RESOURCES_LINKS = [
  {
    label: "Documentation",
    href: "/docs",
    description: "Guides for getting the most out of Codewix.",
  },
  {
    label: "Changelog",
    href: "/changelog",
    description: "See what's new and recently shipped.",
  },
  {
    label: "Community",
    href: "/community",
    description: "Connect with other people building on Codewix.",
  },
  {
    label: "Support",
    href: "/support",
    description: "Get help from the Codewix team.",
  },
];

function SiteHeader({ initialUser }: { initialUser?: CurrentUser | null }) {
  const router = useRouter();
  const { user, loaded, setUser } = useCurrentUser(initialUser);

  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [isNavigatingHome, startNavigateHome] = useTransition();
  const resourcesCloseTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sectionIds = NAV_LINKS.filter((link) => "sectionId" in link).map(
      (link) => (link as { sectionId: string }).sectionId,
    );
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  function openResources() {
    if (resourcesCloseTimeout.current) {
      clearTimeout(resourcesCloseTimeout.current);
      resourcesCloseTimeout.current = null;
    }
    setResourcesOpen(true);
  }

  function scheduleCloseResources() {
    resourcesCloseTimeout.current = setTimeout(() => {
      setResourcesOpen(false);
    }, 150);
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
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

  const isBusy = signingOut || isNavigatingHome;
  const getStartedHref = user ? `/${user.id}` : "#hero";

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "border-b border-white/10 bg-[#1e1b4b]/70 shadow-lg shadow-black/20 backdrop-blur-xl"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href={user ? `/${user.id}` : "/"}
          className="flex shrink-0 items-center gap-2"
        >
          <span className="text-2xl font-extrabold tracking-tight text-white">
            CODEWIX
          </span>
        </Link>

        <nav className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive =
              "sectionId" in link && activeSection === link.sectionId;
            return (
              <Link
                key={link.label}
                href={link.href}
                className={cn(
                  "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "text-white"
                    : "text-white/70 hover:text-white",
                )}
              >
                {link.label}
                {isActive && (
                  <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-cyan-300" />
                )}
              </Link>
            );
          })}

          <div
            className="relative"
            onMouseEnter={openResources}
            onMouseLeave={scheduleCloseResources}
          >
            <button
              type="button"
              onClick={() => setResourcesOpen((v) => !v)}
              aria-expanded={resourcesOpen}
              className={cn(
                "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                resourcesOpen ? "text-white" : "text-white/70 hover:text-white",
              )}
            >
              Resources
              <ChevronDown
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  resourcesOpen && "rotate-180",
                )}
              />
            </button>

            <div
              className={cn(
                "absolute left-1/2 top-full w-72 -translate-x-1/2 pt-3 transition-all duration-200",
                resourcesOpen
                  ? "pointer-events-auto translate-y-0 opacity-100"
                  : "pointer-events-none -translate-y-1 opacity-0",
              )}
            >
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1e1b4b]/95 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
                {RESOURCES_LINKS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-white/10"
                  >
                    <div className="text-sm font-medium text-white">
                      {item.label}
                    </div>
                    <div className="mt-0.5 text-xs text-white/60">
                      {item.description}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          {!loaded || isBusy ? (
            <div className="h-9 w-24 animate-pulse rounded-xl bg-white/10" />
          ) : user ? (
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger className="max-w-40 truncate rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20">
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
            <Link
              href="/signin"
              className="rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
            >
              Sign in
            </Link>
          )}

          {!user && (
            <Link
              href={getStartedHref}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500/90"
            >
              Get Started
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open menu"
          className="flex size-10 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-white backdrop-blur-md lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0 bg-[#0f0d2b]/80 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="animate-in slide-in-from-top-4 fade-in absolute inset-x-0 top-0 max-h-[85vh] overflow-y-auto rounded-b-2xl border-b border-white/10 bg-[#1e1b4b] p-4 shadow-2xl duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xl font-extrabold tracking-tight text-white">
                CODEWIX
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close menu"
                className="flex size-10 items-center justify-center rounded-xl border border-white/30 bg-white/10 text-white"
              >
                <X className="size-5" />
              </button>
            </div>

            <nav className="mt-6 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}

              <div className="mt-2 border-t border-white/10 pt-2">
                <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-white/40">
                  Resources
                </div>
                {RESOURCES_LINKS.map((item) => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg px-3 py-3 text-base font-medium text-white/85 transition hover:bg-white/10 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>

            <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-6">
              {!loaded || isBusy ? (
                <div className="h-11 w-full animate-pulse rounded-xl bg-white/10" />
              ) : user ? (
                <>
                  <Link
                    href={`/user/${user.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-center text-sm font-medium text-white"
                  >
                    My projects
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                    className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-center text-sm font-medium text-red-300"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/signin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-center text-sm font-medium text-white"
                  >
                    Sign in
                  </Link>
                  <Link
                    href={getStartedHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-xl bg-blue-500 px-4 py-3 text-center text-sm font-medium text-white shadow-lg"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
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

export default memo(SiteHeader);
