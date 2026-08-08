import { getAllModels, getProviderModelId } from "./ai-provider";

// ──────────────────────────────────────────────────────────────────────
// Backward-compatible constants
//
// MODELS, resolveModel, PLANNING_MODEL etc. are still exported so existing
// call-sites compile without changes.  Under the hood they now delegate to
// the multi-provider registry in ai-provider.ts.
// ──────────────────────────────────────────────────────────────────────

/** @deprecated Use ai-provider.ts directly. Kept for backward compat. */
export function resolveModel(model: string): string {
  return getProviderModelId(model);
}

/** Model used for the "software architect" plan step in create-chat.
 *  mistral-large-latest: strongest general-purpose reasoning on the
 *  active Mistral provider — best fit for the planning step. */
export const PLANNING_MODEL = "mistral-large-latest";

/** Model used for lightweight chat title generation.
 *  mistral-small-latest: cheap & fast — ideal for the 24-token title call. */
export const TITLE_MODEL = "mistral-small-latest";

export type ModelOption = {
  label: string;
  value: string;
  hidden?: boolean;
  note?: string;
};

/**
 * Flat list consumed by the UI picker and the /api/update-chat-model
 * validation endpoint.  Derived from the registry — the `value` is the
 * model *slug* (e.g. "codestral-latest"), NOT the provider-level model ID.
 */
export const MODELS: ModelOption[] = getAllModels(true, false).map((m) => ({
  label: m.label,
  value: m.slug,
  hidden: m.hidden,
  note: m.note,
}));

export const SUGGESTED_PROMPTS = [
  {
    title: "Sneaker Drop",
    description:
      "Build a one-page landing page for a limited sneaker drop: a bold hero with the drop name and release tagline, a short 'the drop' block listing the colorways with their release times, and a release-date call-to-action. Aesthetic: loud, athletic, and confident, with a light background, one saturated accent, chunky bold display type, and tight, punchy spacing.",
  },
  {
    title: "Expense Tracker",
    description:
      "Make a personal expense tracker where I can log expenses with categories like food, transport, and entertainment. Show a monthly breakdown with interactive pie and bar charts plus a running total. Aesthetic: a calm, cool financial-ledger feel, with a serif display heading over a tight, gridded data layout.",
  },
  {
    title: "Sourdough",
    description:
      "Build a one-page site for a sourdough bakery: a hero introducing the bakery and its signature loaf, a fermentation timeline shown as a day-by-day horizontal sequence, and a 'today's bake' schedule. Aesthetic: warm, editorial, and hand-made, like a small bakery's own printed booklet.",
  },
  {
    title: "Team Chat",
    description:
      "Build a one-page team chat app: a sidebar listing a few channels and direct messages, a main pane showing the selected channel's message thread, and a composer to send a message. Seed a few channels and messages, and append new messages locally. Aesthetic: a clean SaaS app shell, with a sidebar plus a content area, a calm neutral base, and one accent for the active channel and the send button.",
  },
  {
    title: "Beat Maker",
    description:
      "Build a one-page beat maker: a step-sequencer grid of a few drum sounds across 8 or 16 steps, a play/stop button, and a tempo slider. Tapping a cell arms it, and play loops through the steps, triggering each sound with the Web Audio API (synthesize the sounds, no external samples). Aesthetic: a bold, playful grid, with bright accent pads on a dark surface and chunky controls.",
  },
  {
    title: "Palette",
    description:
      "Build a one-page color palette generator: a row of five swatches, a button to generate a new harmonious palette, and the ability to lock individual swatches so they survive regeneration. Show each color's hex value and copy it on click. Aesthetic: a clean design-tool feel, with big full-bleed swatches, minimal chrome, and the palette as the page.",
  },
];
