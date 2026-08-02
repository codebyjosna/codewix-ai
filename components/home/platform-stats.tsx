import { Cpu, Rocket, Timer, Users } from "lucide-react";

import Reveal from "@/components/home/reveal";
import { MODELS } from "@/lib/constants";

export default function PlatformStats({
  appCount,
  userCount,
}: {
  appCount: number;
  userCount: number;
}) {
  const modelCount = MODELS.filter((m) => !m.hidden).length;

  const stats = [
    {
      label: "Apps generated",
      value: `${appCount.toLocaleString()}+`,
      icon: Rocket,
    },
    {
      label: "Developers building",
      value: `${userCount.toLocaleString()}+`,
      icon: Users,
    },
    {
      label: "AI models available",
      value: `${modelCount}`,
      icon: Cpu,
    },
    {
      label: "AI availability",
      value: "24/7",
      icon: Timer,
    },
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#1e3a8a] to-[#4c1d95] py-20 sm:py-28">
      <div className="animate-gradient-shift pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600 via-fuchsia-600 to-cyan-500 opacity-40" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-300 backdrop-blur-md">
              Platform
            </span>
            <h2 className="mt-4 text-balance text-3xl font-bold tracking-tight text-white drop-shadow-sm sm:text-4xl">
              Growing every day
            </h2>
          </div>
        </Reveal>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 100}>
              <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-md">
                <stat.icon className="size-6 text-cyan-300" aria-hidden="true" />
                <div className="mt-3 text-3xl font-bold text-white">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-white/70">{stat.label}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
