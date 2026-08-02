"use client";

import { ArrowRight } from "lucide-react";

import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";
import { SUGGESTED_PROMPTS } from "@/lib/constants";

export default function ExampleProjects({
  onSelectExample,
}: {
  onSelectExample: (description: string) => void;
}) {
  return (
    <section id="showcase" className="scroll-mt-24 bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Showcase"
            title="See what people are building"
            subtitle="Real project prompts you can try yourself — pick one to load it straight into the builder."
          />
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SUGGESTED_PROMPTS.map((example, index) => (
            <Reveal key={example.title} delay={(index % 3) * 100}>
              <div className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg">
                <h3 className="text-lg font-semibold text-gray-900">
                  {example.title}
                </h3>
                <p className="mt-2 line-clamp-4 flex-1 text-sm leading-relaxed text-gray-600">
                  {example.description}
                </p>
                <button
                  type="button"
                  onClick={() => onSelectExample(example.description)}
                  className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-semibold text-blue-600 transition hover:text-blue-700"
                >
                  Try this idea
                  <ArrowRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
