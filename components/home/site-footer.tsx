import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Templates", href: "#templates" },
  { label: "Showcase", href: "#showcase" },
];

const RESOURCES_LINKS = [
  { label: "Documentation", href: "/docs" },
  { label: "Blog", href: "/blog" },
  { label: "Changelog", href: "/changelog" },
  { label: "Support", href: "/support" },
];

const COMPANY_LINKS = [
  { label: "FAQ", href: "#faq" },
  { label: "Sign in", href: "/signin" },
  { label: "Create account", href: "/signup" },
];

export default function SiteFooter() {
  return (
    <footer className="bg-[#100e29] text-white/70">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-2xl font-extrabold tracking-tight text-white">
              CODEWIX
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/60">
              Turn your idea into a real, working app — powered by AI models
              that pick themselves.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/40">
              Product
            </h3>
            <ul className="mt-4 space-y-3">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/40">
              Resources
            </h3>
            <ul className="mt-4 space-y-3">
              {RESOURCES_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-white/40">
              Company
            </h3>
            <ul className="mt-4 space-y-3">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/70 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-8 text-sm text-white/50 sm:flex-row">
          {/* L14: suppressHydrationWarning guards against the rare case where
              server and client render the year differently around midnight UTC. */}
          <div suppressHydrationWarning>
            &copy; {new Date().getFullYear()} Codewix. All rights reserved.
          </div>
          <div>Powered by NVIDIA NIM</div>
        </div>
      </div>
    </footer>
  );
}
