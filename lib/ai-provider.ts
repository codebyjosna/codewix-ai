import OpenAI from "openai";

// ──────────────────────────────────────────────────────────────────────
// Multi-provider AI registry
//
// This file is the SINGLE SOURCE OF TRUTH for which AI providers back
// each model.  The user NEVER sees provider names — only clean model labels
// like "Llama 3.3 70B" or "Gemini 2.5 Flash".  The server maps each model
// slug to the correct provider (API key + base URL) automatically.
//
// Security: all API keys are server-side only (process.env).  The client
// only ever sends/receives the model slug string.
// ──────────────────────────────────────────────────────────────────────

// ---------- Provider definitions ----------

type ProviderConfig = {
  /** Environment variable name that holds the API key */
  envKey: string;
  /** OpenAI-compatible base URL */
  baseURL: string;
  /** Human-readable name (server-side only, never sent to client) */
  name: string;
};

const PROVIDERS: Record<string, ProviderConfig> = {
  groq: {
    envKey: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    name: "Groq",
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    name: "Google Gemini",
  },
  cerebras: {
    envKey: "CEREBRAS_API_KEY",
    baseURL: "https://api.cerebras.ai/v1",
    name: "Cerebras",
  },
  openrouter: {
    envKey: "OPENROUTER_API_KEY",
    baseURL: "https://openrouter.ai/api/v1",
    name: "OpenRouter",
  },
};

// ---------- Model registry ----------

export type ModelRegistryEntry = {
  /** Internal slug used in DB, API calls, and client state */
  slug: string;
  /** Clean label shown to the user in the UI */
  label: string;
  /** Provider key — maps to PROVIDERS above */
  provider: string;
  /** Actual model ID sent to the provider's API */
  modelId: string;
  /** Whether the model appears in the user-facing picker */
  hidden?: boolean;
  /** Optional hint shown under the label (e.g. "Fastest") */
  note?: string;
};

export const MODEL_REGISTRY: Record<string, ModelRegistryEntry> = {
  // ── Groq models ──────────────────────────────────────────────────
  "llama-3.3-70b": {
    slug: "llama-3.3-70b",
    label: "Llama 3.3 70B",
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    note: "⚡ Fastest",
  },
  "qwen-3.6-27b": {
    slug: "qwen-3.6-27b",
    label: "Qwen 3.6 27B",
    provider: "groq",
    modelId: "qwen/qwen3.6-27b",
    note: "🚀 Quick & capable",
  },
  "llama-3.1-8b": {
    slug: "llama-3.1-8b",
    label: "Llama 3.1 8B",
    provider: "groq",
    modelId: "llama-3.1-8b-instant",
    hidden: true,
  },
  "gpt-oss-120b": {
    slug: "gpt-oss-120b",
    label: "GPT-OSS 120B",
    provider: "groq",
    modelId: "openai/gpt-oss-120b",
    hidden: true,
  },
  "gpt-oss-20b": {
    slug: "gpt-oss-20b",
    label: "GPT-OSS 20B",
    provider: "groq",
    modelId: "openai/gpt-oss-20b",
    hidden: true,
  },

  // ── Google Gemini models ─────────────────────────────────────────
  "gemini-2.5-flash": {
    slug: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    modelId: "gemini-2.5-flash",
    note: "🔥 Smart & fast",
  },
  "gemini-2.5-pro": {
    slug: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    modelId: "gemini-2.5-pro",
    note: "💎 Best quality",
  },

  // ── Cerebras models ──────────────────────────────────────────────
  "cerebras-llama-70b": {
    slug: "cerebras-llama-70b",
    label: "Llama 3.3 70B Ultra",
    provider: "cerebras",
    modelId: "llama-3.3-70b",
    note: "🚄 Ultra-fast inference",
  },

  // ── OpenRouter models ────────────────────────────────────────────
  "deepseek-v3": {
    slug: "deepseek-v3",
    label: "DeepSeek V3",
    provider: "openrouter",
    modelId: "deepseek/deepseek-chat-v3-0324:free",
    note: "🧠 Strong reasoning",
  },
};

// ---------- Public helpers ----------

/** Get all registry entries (optionally filtered to non-hidden). */
export function getAllModels(hideHidden = true): ModelRegistryEntry[] {
  return Object.values(MODEL_REGISTRY).filter((m) => {
    // Filter out explicitly hidden models
    if (m.hidden && hideHidden) return false;
    // Auto-hide models whose provider API key is not configured
    const provider = PROVIDERS[m.provider];
    if (!provider || !process.env[provider.envKey]) return false;
    return true;
  });
}

/** Look up a single model by slug. Returns undefined if not found. */
export function getModel(slug: string): ModelRegistryEntry | undefined {
  return MODEL_REGISTRY[slug];
}

/**
 * Resolve a slug (or raw model ID) to a registry entry.
 * Supports backward compatibility: if the slug isn't in the registry,
 * tries the alias map, then returns a Groq fallback.
 */
export function resolveModelSlug(slug: string): ModelRegistryEntry {
  // Direct lookup
  const entry = MODEL_REGISTRY[slug];
  if (entry) return entry;

  // Backward compat: check if it's an old NVIDIA/Groq model ID
  const aliased = LEGACY_SLUG_ALIASES[slug];
  if (aliased) {
    const resolved = MODEL_REGISTRY[aliased];
    if (resolved) return resolved;
  }

  // Fallback: treat as a raw Groq model ID
  return {
    slug,
    label: slug,
    provider: "groq",
    modelId: slug,
    hidden: true,
  };
}

/**
 * Create an OpenAI client pre-configured for the provider that backs
 * the given model slug.
 */
export function getAIClientForModel(slug: string): OpenAI {
  const entry = resolveModelSlug(slug);
  const provider = PROVIDERS[entry.provider];
  if (!provider) {
    throw new Error(`Unknown provider: ${entry.provider} (model: ${slug})`);
  }
  const apiKey = process.env[provider.envKey];
  if (!apiKey) {
    throw new Error(
      `Missing ${provider.envKey}. Set it in your environment variables.`,
    );
  }
  return new OpenAI({
    apiKey,
    baseURL: provider.baseURL,
  });
}

/** Get the raw provider-level model ID for a given slug. */
export function getProviderModelId(slug: string): string {
  return resolveModelSlug(slug).modelId;
}

/** Get the provider name (for logging only — never sent to client). */
export function getProviderName(slug: string): string {
  const entry = resolveModelSlug(slug);
  return PROVIDERS[entry.provider]?.name ?? entry.provider;
}

/** Check if a slug is a valid, known model (including legacy aliases). */
export function isValidModel(slug: string): boolean {
  if (slug in MODEL_REGISTRY) return true;
  if (slug in LEGACY_SLUG_ALIASES) return true;
  // Also accept raw provider-level model IDs that are used in registry entries
  return Object.values(MODEL_REGISTRY).some((m) => m.modelId === slug);
}

// ---------- Legacy alias map ----------
// Maps old model IDs (stored in DB from NVIDIA era or earlier Groq era)
// to current registry slugs so existing chats keep working.

const LEGACY_SLUG_ALIASES: Record<string, string> = {
  // Old NVIDIA NIM IDs
  "z-ai/glm-5.2": "llama-3.3-70b",
  "zai-org/GLM-4.6": "llama-3.3-70b",
  "zai-org/GLM-5": "llama-3.3-70b",
  "zai-org/GLM-5.1": "llama-3.3-70b",
  "zai-org/GLM-5.2": "llama-3.3-70b",
  "moonshotai/kimi-k2-instruct": "qwen-3.6-27b",
  "moonshotai/kimi-k2-thinking": "llama-3.3-70b",
  "moonshotai/Kimi-K2.5": "qwen-3.6-27b",
  "moonshotai/Kimi-K2-Instruct-0905": "qwen-3.6-27b",
  "moonshotai/Kimi-K2.7-Code": "qwen-3.6-27b",
  "moonshotai/Kimi-K2.6": "llama-3.3-70b",
  "nvidia/nemotron-3-ultra-550b-a55b": "llama-3.3-70b",
  "qwen/qwen3-coder-480b-a35b-instruct": "llama-3.3-70b",
  "Qwen/Qwen3-Coder-Next-FP8": "llama-3.3-70b",
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8": "llama-3.3-70b",
  "Qwen/Qwen2.5-Coder-32B-Instruct": "qwen-3.6-27b",
  "minimaxai/minimax-m2.7": "qwen-3.6-27b",
  "MiniMaxAI/MiniMax-M2.5": "qwen-3.6-27b",
  "MiniMaxAI/MiniMax-M2.7": "qwen-3.6-27b",
  "MiniMaxAI/MiniMax-M3": "qwen-3.6-27b",
  "Qwen/Qwen3.7-Max": "llama-3.3-70b",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-FP8": "llama-3.3-70b",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-tput": "llama-3.3-70b",
  "deepseek-ai/DeepSeek-V3": "deepseek-v3",
  "deepseek-ai/DeepSeek-V3.1": "deepseek-v3",
  "deepseek-ai/deepseek-v4-pro": "llama-3.3-70b",
  "meta/llama-3.3-70b-instruct": "llama-3.3-70b",
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "llama-3.3-70b",
  "openai/gpt-oss-120b": "gpt-oss-120b",
  "openai/gpt-oss-20b": "gpt-oss-20b",

  // Direct Groq model IDs (raw, not slugs) — map to slug equivalents
  "llama-3.3-70b-versatile": "llama-3.3-70b",
  "qwen/qwen3.6-27b": "qwen-3.6-27b",
  "llama-3.1-8b-instant": "llama-3.1-8b",
};
