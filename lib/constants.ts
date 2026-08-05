// Groq model ID aliases — maps old NVIDIA/Together model IDs to their Groq
// equivalents so existing DB rows referencing an old ID keep working after the
// NVIDIA → Groq migration.
export const MODEL_ALIASES: Record<string, string> = {
  // Legacy NVIDIA NIM model IDs → Groq replacements
  "z-ai/glm-5.2": "llama-3.3-70b-versatile",
  "zai-org/GLM-4.6": "llama-3.3-70b-versatile",
  "zai-org/GLM-5": "llama-3.3-70b-versatile",
  "zai-org/GLM-5.1": "llama-3.3-70b-versatile",
  "zai-org/GLM-5.2": "llama-3.3-70b-versatile",

  "moonshotai/kimi-k2-instruct": "qwen/qwen3.6-27b",
  "moonshotai/kimi-k2-thinking": "llama-3.3-70b-versatile",
  "moonshotai/Kimi-K2.5": "qwen/qwen3.6-27b",
  "moonshotai/Kimi-K2-Instruct-0905": "qwen/qwen3.6-27b",
  "moonshotai/Kimi-K2.7-Code": "qwen/qwen3.6-27b",
  "moonshotai/Kimi-K2.6": "llama-3.3-70b-versatile",

  "nvidia/nemotron-3-ultra-550b-a55b": "llama-3.3-70b-versatile",

  "qwen/qwen3-coder-480b-a35b-instruct": "llama-3.3-70b-versatile",
  "Qwen/Qwen3-Coder-Next-FP8": "llama-3.3-70b-versatile",
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8": "llama-3.3-70b-versatile",
  "Qwen/Qwen2.5-Coder-32B-Instruct": "qwen/qwen3.6-27b",

  "minimaxai/minimax-m2.7": "qwen/qwen3.6-27b",
  "MiniMaxAI/MiniMax-M2.5": "qwen/qwen3.6-27b",
  "MiniMaxAI/MiniMax-M2.7": "qwen/qwen3.6-27b",
  "MiniMaxAI/MiniMax-M3": "qwen/qwen3.6-27b",
  "Qwen/Qwen3.7-Max": "llama-3.3-70b-versatile",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-FP8": "llama-3.3-70b-versatile",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-tput": "llama-3.3-70b-versatile",

  "deepseek-ai/DeepSeek-V3": "qwen/qwen3.6-27b",
  "deepseek-ai/DeepSeek-V3.1": "qwen/qwen3.6-27b",
  "deepseek-ai/deepseek-v4-pro": "llama-3.3-70b-versatile",

  "meta/llama-3.3-70b-instruct": "llama-3.3-70b-versatile",
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "llama-3.3-70b-versatile",

  // OpenAI open-source models on Groq
  "openai/gpt-oss-120b": "llama-3.3-70b-versatile",
  "openai/gpt-oss-20b": "qwen/qwen3.6-27b",
};

export function resolveModel(model: string): string {
  return MODEL_ALIASES[model] ?? model;
}

// Model used for the "software architect" plan step in create-chat.
// Uses the best available Groq model for non-streaming completions.
export const PLANNING_MODEL = "llama-3.3-70b-versatile";

export type ModelOption = {
  label: string;
  value: string;
  hidden?: boolean;
  // Optional muted hint shown next to the label in the picker (e.g. "slower").
  note?: string;
};

// Selectable (non-hidden) models are the two best Groq models for code gen.
// Hidden entries are kept so existing DB rows and MODEL_ALIASES keep resolving.
export const MODELS: ModelOption[] = [
  {
    label: "Llama 3.3 70B",
    value: "llama-3.3-70b-versatile",
  },
  {
    label: "Qwen 3.6 27B",
    value: "qwen/qwen3.6-27b",
    note: "faster",
  },
  {
    label: "GPT-OSS 120B",
    value: "openai/gpt-oss-120b",
    hidden: true,
  },
  {
    label: "GPT-OSS 20B",
    value: "openai/gpt-oss-20b",
    hidden: true,
  },
  {
    label: "Llama 3.1 8B",
    value: "llama-3.1-8b-instant",
    hidden: true,
  },
];

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
