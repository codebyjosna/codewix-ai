"use client";

export default function ProjectCreatingOverlay() {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#1e1b4b] via-[#1e3a8a] to-[#4c1d95] duration-300 animate-in fade-in">
      <div className="animate-gradient-shift pointer-events-none absolute inset-0 bg-gradient-to-br from-blue-600 via-fuchsia-600 to-cyan-500 opacity-70" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float-orb absolute -left-24 -top-24 h-96 w-96 rounded-full bg-cyan-400/40 blur-[100px]" />
        <div className="animate-float-orb-slow absolute -right-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500/40 blur-[110px]" />
        <div className="animate-float-orb-delay absolute -bottom-32 left-1/3 h-[26rem] w-[26rem] rounded-full bg-blue-500/40 blur-[100px]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative isolate flex flex-col items-center gap-7 px-6 text-center">
        <div className="relative flex size-24 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-cyan-300/20" />
          <div className="absolute inset-0 rounded-full border-4 border-white/10" />
          <div
            className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-r-cyan-300 border-t-cyan-300"
            style={{ animationDuration: "900ms" }}
          />
          <div
            className="absolute inset-2 rounded-full border-4 border-transparent border-l-fuchsia-400 border-t-fuchsia-400"
            style={{
              animation: "spin 1.4s linear infinite reverse",
            }}
          />
        </div>

        <div className="space-y-2">
          <p className="animate-pulse text-balance text-2xl font-medium text-white drop-shadow-sm md:text-3xl">
            Analysing Your Project
          </p>
          <p className="text-sm text-white/60">
            Saving your project and picking the best model for your idea
            &hellip;
          </p>
        </div>
      </div>
    </div>
  );
}
