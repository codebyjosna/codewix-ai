"use client";

import {
  Apple,
  Gamepad2,
  Globe,
  LayoutDashboard,
  LayoutGrid,
  Newspaper,
  Puzzle,
  Rocket,
  Server,
  ShoppingCart,
  Smartphone,
  Sparkles,
  UserCircle,
} from "lucide-react";

import Reveal from "@/components/home/reveal";
import SectionHeading from "@/components/home/section-heading";

export type ProjectTypeOption = {
  id: string;
  name: string;
  slug: string;
};

const TEMPLATE_ICONS: Record<string, typeof Sparkles> = {
  website: Globe,
  "web-application": LayoutGrid,
  "landing-page": Rocket,
  portfolio: UserCircle,
  "ecommerce-store": ShoppingCart,
  blog: Newspaper,
  "dashboard-admin-panel": LayoutDashboard,
  "android-application": Smartphone,
  "ios-application": Apple,
  "chrome-extension": Puzzle,
  "api-backend-service": Server,
  game: Gamepad2,
};

const TEMPLATE_DESCRIPTIONS: Record<string, string> = {
  website: "A polished multi-section site to introduce what you do.",
  "web-application": "An interactive app with real state and workflows.",
  "landing-page": "A focused, high-converting single page for one goal.",
  portfolio: "Showcase your work with a personal, project-driven layout.",
  "ecommerce-store": "A storefront with products, cart, and checkout flow.",
  blog: "A clean, readable space for publishing articles and updates.",
  "dashboard-admin-panel": "Data-dense screens for managing and monitoring.",
  "android-application": "A mobile-first Android app experience.",
  "ios-application": "A mobile-first iOS app experience.",
  "chrome-extension": "A lightweight browser extension for a focused task.",
  "api-backend-service": "A backend service exposing a clean API surface.",
  game: "A playable, interactive browser game.",
};

export default function PopularTemplates({
  templates,
  onSelectTemplate,
}: {
  templates: ProjectTypeOption[];
  onSelectTemplate: (template: ProjectTypeOption) => void;
}) {
  if (templates.length === 0) return null;

  return (
    <section id="templates" className="scroll-mt-24 bg-gray-50 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            eyebrow="Templates"
            title="Start from a popular project type"
            subtitle="Pick the kind of app you're building and Codewix takes care of the rest, including picking the right model."
          />
        </Reveal>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((template, index) => {
            const Icon = TEMPLATE_ICONS[template.slug] ?? Sparkles;
            const description =
              TEMPLATE_DESCRIPTIONS[template.slug] ??
              `A production-ready starting point for your ${template.name.toLowerCase()}.`;

            return (
              <Reveal key={template.id} delay={(index % 4) * 75}>
                <button
                  type="button"
                  onClick={() => onSelectTemplate(template)}
                  className="group flex h-full w-full flex-col items-start rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
                >
                  <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-gray-900">
                    {template.name}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    {description}
                  </p>
                </button>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
