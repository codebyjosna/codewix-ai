import OpenAI from "openai";

// ──────────────────────────────────────────────────────────────────────
// Multi-provider AI registry with automatic fallback
//
// This file is the SINGLE SOURCE OF TRUTH for which AI providers back
// each model.  The user NEVER sees provider names — only clean model labels
// like "Llama 3.3 70B" or "Gemini 2.5 Flash".  The server maps each model
// slug to the correct provider (API key + base URL) automatically.
//
// Fallback order: Groq → Gemini → Cerebras → OpenRouter
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

// Provider fallback order — when the primary model's provider fails,
// try the same-prompt generation on the next provider's default model.
const PROVIDER_FALLBACK_ORDER: string[] = ["groq", "gemini", "cerebras", "openrouter"];

// Default model slug for each provider (used when falling back)
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  groq: "llama-3.3-70b",
  gemini: "gemini-2.5-flash",
  cerebras: "cerebras-llama-4-scout",
  openrouter: "openrouter-deepseek-v3",
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
    note: "\u26a1 Fastest",
  },
  "qwen-3.6-27b": {
    slug: "qwen-3.6-27b",
    label: "Qwen 3.6 27B",
    provider: "groq",
    modelId: "qwen/qwen3.6-27b",
    note: "\ud83d\ude80 Quick & capable",
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

  // ── Google Gemini models (best for coding) ─────────────────────
  "gemini-2.5-flash": {
    slug: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    provider: "gemini",
    modelId: "gemini-2.5-flash",
    note: "\ud83d\udd25 Smart & fast",
  },
  "gemini-2.5-pro": {
    slug: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    provider: "gemini",
    modelId: "gemini-2.5-pro",
    note: "\ud83d\udc8e Best quality",
  },

  // ── Cerebras models (unique models, NOT duplicates of Groq) ─────
  "cerebras-llama-4-scout": {
    slug: "cerebras-llama-4-scout",
    label: "Llama 4 Scout",
    provider: "cerebras",
    modelId: "llama-4-scout-17b-16e-instruct",
    note: "\ud83d\ude84 Ultra-fast",
  },
  "cerebras-llama-4-maverick": {
    slug: "cerebras-llama-4-maverick",
    label: "Llama 4 Maverick",
    provider: "cerebras",
    modelId: "llama-4-maverick-17b-128e-instruct",
    note: "\ud83d\ude80 Fast & capable",
  },

  // ── OpenRouter models (unique models, NOT duplicates) ────────────
  "openrouter-deepseek-v3": {
    slug: "openrouter-deepseek-v3",
    label: "DeepSeek V3",
    provider: "openrouter",
    modelId: "deepseek/deepseek-chat-v3-0324:free",
    note: "\ud83e\udde0 Strong reasoning",
  },
  "openrouter-qwen3-coder": {
    slug: "openrouter-qwen3-coder",
    label: "Qwen 3 Coder",
    provider: "openrouter",
    modelId: "qwen/qwen3-coder-480b-a35b-instruct",
    note: "\ud83d\udcbb Code specialist",
  },
};

// ---------- Public helpers ----------

/** Get all registry entries (optionally filtered to non-hidden).
 *
 * By default (hideHidden=true), hidden models are excluded.
 * The `requireApiKey` flag controls whether models whose provider
 * API key is missing are filtered out.  The UI picker MUST pass
 * `requireApiKey=false` so users always see the full model list —
 * key checking happens server-side when a stream is actually requested.
 */
export function getAllModels(hideHidden = true, requireApiKey = false): ModelRegistryEntry[] {
  return Object.values(MODEL_REGISTRY).filter((m) => {
    if (m.hidden && hideHidden) return false;
    if (requireApiKey) {
      const provider = PROVIDERS[m.provider];
      if (!provider || !process.env[provider.envKey]) return false;
    }
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
  const entry = MODEL_REGISTRY[slug];
  if (entry) return entry;

  const aliased = LEGACY_SLUG_ALIASES[slug];
  if (aliased) {
    const resolved = MODEL_REGISTRY[aliased];
    if (resolved) return resolved;
  }

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
    throw new AIProviderError(
      `UNKNOWN_PROVIDER`,
      `Unknown provider: ${entry.provider} (model: ${slug})`,
      entry.provider,
      entry.slug,
      false,
    );
  }
  const apiKey = getProviderApiKey(entry.provider);
  if (!apiKey) {
    throw new AIProviderError(
      `MISSING_API_KEY`,
      `${provider.name} ${entry.label} API key is missing or cannot fetch. Please configure ${provider.envKey} in environment variables.`,
      entry.provider,
      entry.slug,
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
  return Object.values(MODEL_REGISTRY).some((m) => m.modelId === slug);
}

// ---------- Provider fallback chain ----------

/**
 * Custom error class that carries structured metadata about which
 * provider and model failed, so the fallback chain and the error
 * dialog can produce precise user-facing messages.
 */
export class AIProviderError extends Error {
  readonly code: string;
  readonly providerKey: string;
  readonly modelSlug: string;
  readonly isRetryable: boolean;

  constructor(
    code: string,
    message: string,
    providerKey: string,
    modelSlug: string,
    isRetryable = true,
  ) {
    super(message);
    this.name = "AIProviderError";
    this.code = code;
    this.providerKey = providerKey;
    this.modelSlug = modelSlug;
    this.isRetryable = isRetryable;
  }
}

function isMissingApiKeyError(err: unknown): boolean {
  if (err instanceof AIProviderError && err.code === "MISSING_API_KEY") return true;
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return (
      m.includes("api key") ||
      (m.includes("missing ") && m.includes("environment"))
    );
  }
  return false;
}

function isProviderQuotaOrDownError(err: unknown): boolean {
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return (
      m.includes("429") ||
      m.includes("rate limit") ||
      m.includes("quota") ||
      m.includes("502") ||
      m.includes("503") ||
      m.includes("500") ||
      m.includes("overloaded") ||
      m.includes("capacity") ||
      m.includes("unavailable") ||
      m.includes("service")
    );
  }
  return false;
}

/**
 * Build a human-readable error message for a provider failure.
 */
function buildProviderErrorMessage(
  providerKey: string,
  modelSlug: string,
  err: unknown,
): string {
  const providerName = PROVIDERS[providerKey]?.name ?? providerKey;
  const modelEntry = MODEL_REGISTRY[modelSlug];
  const modelLabel = modelEntry?.label ?? modelSlug;

  if (isMissingApiKeyError(err)) {
    return `${providerName} ${modelLabel} API key is missing or cannot fetch. Please configure ${PROVIDERS[providerKey]?.envKey ?? providerKey} in environment variables.`;
  }

  if (isProviderQuotaOrDownError(err)) {
    const errMessage = err instanceof Error ? err.message : "";
    if (errMessage.includes("429") || errMessage.includes("rate limit") || errMessage.includes("quota")) {
      return `${providerName} ${modelLabel} is not responding because token quota reached or rate limited. Try again later or switch to a different model.`;
    }
    return `${providerName} ${modelLabel} is not responding. Provider sites may be down. Try again later or switch to a different model.`;
  }

  const errMessage = err instanceof Error ? err.message : "Unknown error";
  return `${providerName} ${modelLabel} failed: ${errMessage}`;
}

/**
 * Get the list of fallback provider keys starting from the given model's
 * provider. For example, if the model is on "groq", returns
 * ["gemini", "cerebras", "openrouter"] (skipping groq itself since it
 * already failed).
 *
 * The chain wraps around circularly — if the primary provider is the last
 * one (e.g. openrouter), we circle back to the first (groq) so that
 * provider-exclusive models (e.g. Qwen 3 Coder on OpenRouter) can still
 * fall back to Groq / Gemini / Cerebras.
 */
function getFallbackProviders(primaryProviderKey: string): string[] {
  const idx = PROVIDER_FALLBACK_ORDER.indexOf(primaryProviderKey);
  if (idx === -1) return [...PROVIDER_FALLBACK_ORDER];
  // Take everything after the primary, then wrap around to the beginning
  const after = PROVIDER_FALLBACK_ORDER.slice(idx + 1);
  const before = PROVIDER_FALLBACK_ORDER.slice(0, idx);
  return [...after, ...before];
}

/**
 * Get ALL available fallback model entries (have an API key configured),
 * ordered by the provider fallback chain (Groq -> Gemini -> Cerebras -> OpenRouter).
 * Skips the primary model's provider since it already failed.
 * Returns an array so the caller can try every provider in sequence.
 */
export function getAllFallbackModels(
  primaryModelSlug: string,
): ModelRegistryEntry[] {
  const primaryEntry = resolveModelSlug(primaryModelSlug);
  const fallbacks = getFallbackProviders(primaryEntry.provider);
  const results: ModelRegistryEntry[] = [];

  for (const providerKey of fallbacks) {
    const provider = PROVIDERS[providerKey];
    if (!provider || !getProviderApiKey(providerKey)) continue;

    const fallbackSlug = PROVIDER_DEFAULT_MODEL[providerKey];
    if (!fallbackSlug) continue;

    const entry = MODEL_REGISTRY[fallbackSlug];
    if (entry) results.push(entry);
  }

  return results;
}

/**
 * @deprecated Use getAllFallbackModels instead — returns all fallbacks,
 * not just the first one.
 */
export function getFirstAvailableFallback(
  primaryModelSlug: string,
): ModelRegistryEntry | null {
  return getAllFallbackModels(primaryModelSlug)[0] ?? null;
}

/**
 * Build the final "all providers failed" error message.
 */
export function buildAllProvidersFailedMessage(
  errors: Array<{ provider: string; model: string; error: string }>,
): string {
  const lines = errors.map(
    (e) => {
      const pName = PROVIDERS[e.provider]?.name ?? e.provider;
      return `- ${pName} (${e.model}): ${e.error}`;
    },
  );

  return `All AI models failed. None of the configured providers could generate a response:\n\n${lines.join("\n")}\n\nPlease check your API keys and provider status, then try again.`;
}

// ---------- Legacy alias map ----------

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
  "deepseek-ai/DeepSeek-V3": "openrouter-deepseek-v3",
  "deepseek-ai/DeepSeek-V3.1": "openrouter-deepseek-v3",
  "deepseek-ai/deepseek-v4-pro": "llama-3.3-70b",
  "meta/llama-3.3-70b-instruct": "llama-3.3-70b",
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "llama-3.3-70b",
  "openai/gpt-oss-120b": "gpt-oss-120b",
  "openai/gpt-oss-20b": "gpt-oss-20b",
  // Old cerebras-llama-70b slug (was a duplicate of Groq llama-3.3-70b)
  "cerebras-llama-70b": "cerebras-llama-4-scout",
  // Old deepseek-v3 slug (now namespaced under openrouter)
  "deepseek-v3": "openrouter-deepseek-v3",
  // Direct Groq model IDs (raw, not slugs)
  "llama-3.3-70b-versatile": "llama-3.3-70b",
  "qwen/qwen3.6-27b": "qwen-3.6-27b",
  "llama-3.1-8b-instant": "llama-3.1-8b",
};


// ---------- Static env-var access (webpack-compatible) ----------
//
// In Next.js standalone mode, process.env is empty at runtime.
// The next.config.ts env: block bakes values ONLY for references
// that webpack can statically analyze (e.g. process.env.GROQ_API_KEY).
// Dynamic access like process.env[variable] is NOT replaced and
// returns undefined at runtime.  This helper uses a switch statement
// so every branch is a static, analyzable reference.

function getProviderApiKey(providerKey: string): string | undefined {
  switch (providerKey) {
    case 'groq':     return process.env.GROQ_API_KEY;
    case 'gemini':   return process.env.GEMINI_API_KEY;
    case 'cerebras': return process.env.CEREBRAS_API_KEY;
    case 'openrouter': return process.env.OPENROUTER_API_KEY;
    default: return undefined;
  }
}
export { PROVIDERS, PROVIDER_FALLBACK_ORDER, buildProviderErrorMessage };
