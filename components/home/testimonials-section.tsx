import { Quote } from "lucide-react";

import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";
import { TESTIMONIALS } from "@/lib/marketing-content";

const AVATAR_GRADIENTS = [
  "from-blue-500 to-cyan-400",
  "from-fuchsia-500 to-purple-500",
  "from-cyan-400 to-blue-600",
  "from-purple-500 to-blue-500",
  "from-blue-400 to-fuchsia-500",
  "from-cyan-500 to-purple-500",
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function TestimonialsSection() {
  return (
    <section className="bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Testimonials"
            title="Loved by early builders"
            subtitle="Feedback from developers, designers, and founders using Codewix today."
          />
        </Reveal>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TESTIMONIALS.map((testimonial, index) => (
            <Reveal key={testimonial.name} delay={(index % 3) * 100}>
              <figure className="flex h-full flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <Quote
                  className="size-6 text-blue-200"
                  aria-hidden="true"
                  fill="currentColor"
                />
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-gray-700">
                  &ldquo;{testimonial.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold text-white ${
                      AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length]
                    }`}
                    aria-hidden="true"
                  >
                    {initials(testimonial.name)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {testimonial.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {testimonial.role}
                    </div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
