import {
  Code2,
  Cpu,
  Eye,
  ShieldCheck,
  UploadCloud,
  MessagesSquare,
} from "lucide-react";

import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";
import { WHY_CODEWIX_FEATURES } from "@/lib/marketing-content";

const FEATURE_ICONS = [Code2, Cpu, Eye, ShieldCheck, UploadCloud, MessagesSquare];

export default function WhyCodewix() {
  return (
    <section id="features" className="scroll-mt-24 bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Why Codewix"
            title="Everything you need to ship real apps"
            subtitle="Codewix isn't a toy generator — it's built for apps you actually want to keep building on."
          />
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {WHY_CODEWIX_FEATURES.map((feature, index) => {
            const Icon = FEATURE_ICONS[index];
            return (
              <Reveal key={feature.title} delay={(index % 3) * 100}>
                <div className="h-full rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {feature.description}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
