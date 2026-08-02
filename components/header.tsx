import { memo } from "react";

import Link from "next/link";

function Header({ variant = "light" }: { variant?: "light" | "dark" }) {
  const isDark = variant === "dark";

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

      <button
        type="button"
        className={
          isDark
            ? "rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/20"
            : "rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        }
      >
        Sign in
      </button>
    </header>
  );
}

export default memo(Header);
