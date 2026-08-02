import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";
import { SUPPORTED_TECHNOLOGIES } from "@/lib/marketing-content";

export default function SupportedTechnologies() {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Under the hood"
            title="Built with tools developers already love"
            subtitle="Every generated app is real, modern front-end code — nothing proprietary to learn."
          />
        </Reveal>

        <Reveal delay={100}>
          <div className="mx-auto mt-12 flex max-w-4xl flex-wrap items-center justify-center gap-3">
            {SUPPORTED_TECHNOLOGIES.map((tech) => (
              <span
                key={tech.name}
                className="rounded-full border border-gray-200 bg-gray-50 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                {tech.name}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
