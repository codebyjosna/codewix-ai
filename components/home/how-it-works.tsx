import { MessageSquareText, Cpu, Eye, Rocket } from "lucide-react";

import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";
import { HOW_IT_WORKS_STEPS } from "@/lib/marketing-content";

const STEP_ICONS = [MessageSquareText, Cpu, Eye, Rocket];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="How it works"
            title="From idea to app in four steps"
            subtitle="No setup, no boilerplate — just describe what you want to build."
          />
        </Reveal>

        <div className="relative mt-16 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className="pointer-events-none absolute inset-x-0 top-6 hidden h-px bg-gray-200 lg:block"
            aria-hidden="true"
          />
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Icon = STEP_ICONS[index];
            return (
              <Reveal key={step.title} delay={index * 100}>
                <div className="relative flex flex-col items-start">
                  <div className="relative z-10 flex size-12 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-600 shadow-sm">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <span className="mt-4 text-xs font-semibold uppercase tracking-wide text-blue-500">
                    Step {index + 1}
                  </span>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {step.description}
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
