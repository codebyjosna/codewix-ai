import { Rocket, ShieldCheck, Sparkles, UploadCloud, Heart } from "lucide-react";

import Reveal from "@/components/home/reveal";

const HIGHLIGHTS = [
  { label: "AI Powered", icon: Sparkles },
  { label: "Production Ready", icon: Rocket },
  { label: "Secure & Reliable", icon: ShieldCheck },
  { label: "Export & Deploy", icon: UploadCloud },
  { label: "Loved by Developers", icon: Heart },
];

export default function FeatureHighlightsBar() {
  return (
    <section className="border-b border-gray-100 bg-white py-8">
      <Reveal>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 sm:px-6 lg:px-8">
          {HIGHLIGHTS.map(({ label, icon: Icon }) => (
            <div
              key={label}
              className="flex items-center gap-2 text-sm font-medium text-gray-600"
            >
              <Icon className="size-4 text-blue-500" aria-hidden="true" />
              {label}
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}
