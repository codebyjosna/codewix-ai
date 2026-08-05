import { cn } from "@/lib/utils";

export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  light = false,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  light?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left",
        className,
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide",
            light
              ? "border-white/30 bg-white/10 text-cyan-300 backdrop-blur-md"
              : "border-blue-200 bg-blue-50 text-blue-700",
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "text-balance text-3xl font-bold tracking-tight sm:text-4xl",
          eyebrow ? "mt-4" : "",
          light ? "text-white drop-shadow-sm" : "text-gray-900",
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            "mt-4 text-pretty text-lg",
            light ? "text-white/80" : "text-gray-600",
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
