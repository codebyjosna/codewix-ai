// Legacy Together AI model IDs → current NVIDIA NIM replacements (verified
// against https://docs.api.nvidia.com/nim/reference/llm-apis). resolveModel()
// maps these so existing chats/DB rows that reference an old Together ID
// keep working after the Together AI → NVIDIA NIM migration.
export const MODEL_ALIASES: Record<string, string> = {
  // Historical Together aliases (pre-migration), flattened to their NIM target.
  "zai-org/GLM-4.6": "z-ai/glm-5.2",
  "zai-org/GLM-5": "z-ai/glm-5.2",
  "zai-org/GLM-5.1": "z-ai/glm-5.2",
  "Qwen/Qwen2.5-Coder-32B-Instruct": "z-ai/glm-5.2",
  "MiniMaxAI/MiniMax-M2.5": "minimaxai/minimax-m2.7",
  "MiniMaxAI/MiniMax-M2.7": "minimaxai/minimax-m2.7",
  "moonshotai/Kimi-K2.5": "moonshotai/kimi-k2-instruct",
  "moonshotai/Kimi-K2-Instruct-0905": "moonshotai/kimi-k2-instruct",
  "deepseek-ai/DeepSeek-V3.1": "moonshotai/kimi-k2-instruct",
  "Qwen/Qwen3-Coder-Next-FP8": "qwen/qwen3-coder-480b-a35b-instruct",
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8":
    "qwen/qwen3-coder-480b-a35b-instruct",

  // Together model IDs that used to be the MODELS list's "current" values,
  // now redirected to their NVIDIA NIM equivalent (MODELS below already uses
  // the NIM id directly for new chats; these keep old DB rows working).
  "zai-org/GLM-5.2": "z-ai/glm-5.2",
  "moonshotai/Kimi-K2.7-Code": "moonshotai/kimi-k2-instruct",
  "moonshotai/Kimi-K2.6": "moonshotai/kimi-k2-thinking",
  "Qwen/Qwen3.7-Max": "qwen/qwen3-coder-480b-a35b-instruct",
  "MiniMaxAI/MiniMax-M3": "minimaxai/minimax-m2.7",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-FP8":
    "qwen/qwen3-coder-480b-a35b-instruct",
  "deepseek-ai/DeepSeek-V3": "deepseek-ai/deepseek-v4-pro",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-tput":
    "qwen/qwen3-coder-480b-a35b-instruct",
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "meta/llama-3.3-70b-instruct",
};

export function resolveModel(model: string): string {
  return MODEL_ALIASES[model] ?? model;
}

// Model used for the high-quality "software architect" plan step in
// create-chat. Must support non-streaming completions (create-chat calls it
// with stream=false).
export const PLANNING_MODEL = "qwen/qwen3-coder-480b-a35b-instruct";

export type ModelOption = {
  label: string;
  value: string;
  hidden?: boolean;
  // Optional muted hint shown next to the label in the picker (e.g. "slower").
  note?: string;
};

// Selectable (non-hidden) models are the fast, reliable NVIDIA NIM set plus
// Nemotron 3 Ultra. The hidden entries are kept so existing chats and
// MODEL_ALIASES keep resolving them; all model ids below are verified NVIDIA
// NIM model ids (https://docs.api.nvidia.com/nim/reference/llm-apis).
export const MODELS: ModelOption[] = [
  {
    label: "GLM 5.2",
    value: "z-ai/glm-5.2",
  },
  {
    label: "Kimi K2 Instruct",
    value: "moonshotai/kimi-k2-instruct",
  },
  {
    label: "Kimi K2 Thinking",
    value: "moonshotai/kimi-k2-thinking",
  },
  {
    label: "Nemotron 3 Ultra",
    value: "nvidia/nemotron-3-ultra-550b-a55b",
  },
  {
    label: "Qwen3 Coder 480B",
    value: "qwen/qwen3-coder-480b-a35b-instruct",
    hidden: true,
  },
  {
    label: "MiniMax M2.7",
    value: "minimaxai/minimax-m2.7",
    hidden: true,
  },
  {
    label: "DeepSeek V4 Pro",
    value: "deepseek-ai/deepseek-v4-pro",
    hidden: true,
  },
  {
    label: "Llama 3.3 70B",
    value: "meta/llama-3.3-70b-instruct",
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
