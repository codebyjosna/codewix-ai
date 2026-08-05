import Link from "next/link";
import { ArrowRight } from "lucide-react";

import Reveal from "@/components/home/reveal";

export default function CtaBanner() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e1b4b] via-[#1e3a8a] to-[#4c1d95] px-8 py-16 text-center shadow-2xl shadow-blue-950/30 sm:px-16">
            <div className="animate-gradient-shift pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600 via-fuchsia-600 to-cyan-500 opacity-40" />

            <div className="relative">
              <h2 className="text-balance text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
                Ready to build your next app?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-pretty text-white/80">
                Describe your idea and watch Codewix turn it into a real,
                working app in seconds.
              </p>
              <Link
                href="#hero"
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-gray-900 shadow-lg transition hover:bg-gray-100"
              >
                Get Started Free
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
