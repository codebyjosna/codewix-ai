import OpenAI from "openai";

// ──────────────────────────────────────────────────────────────────────
// Multi-provider AI registry
//
// This file is the SINGLE SOURCE OF TRUTH for which AI providers back
// each model.  The user NEVER sees provider names — only clean model labels
// like "Codestral" or "Mistral Large".  The server maps each model slug to
// the correct provider (API key + base URL) automatically.
//
// ── ACTIVE PROVIDER ───────────────────────────────────────────────────
// Mistral AI (https://api.mistral.ai/v1) is the ONLY active provider.
// The four legacy providers — Groq, Google Gemini, Cerebras, OpenRouter —
// are MUTED: their entries are kept in PROVIDERS so legacy DB rows still
// resolve, but they are removed from PROVIDER_FALLBACK_ORDER and every
// model they back is marked `hidden: true`.  Legacy model slugs (e.g.
// "llama-3.3-70b") are remapped via LEGACY_SLUG_ALIASES to the active
// Mistral equivalent so existing chats keep working.
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
  /** When false, the provider is muted — never selected as fallback, never
   *  surfaces its models in the UI.  Kept here so legacy slug resolution
   *  still compiles and so flipping a provider back on is a one-line change. */
  active: boolean;
};

const PROVIDERS: Record<string, ProviderConfig> = {
  // ── ACTIVE ───────────────────────────────────────────────────────
  mistral: {
    envKey: "MISTRAL_API_KEY",
    baseURL: "https://api.mistral.ai/v1",
    name: "Mistral AI",
    active: true,
  },
  // ── MUTED (kept for backward-compat slug resolution only) ────────
  groq: {
    envKey: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    name: "Groq",
    active: false,
  },
  gemini: {
    envKey: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    name: "Google Gemini",
    active: false,
  },
  cerebras: {
    envKey: "CEREBRAS_API_KEY",
    baseURL: "https://api.cerebras.ai/v1",
    name: "Cerebras",
    active: false,
  },
  openrouter: {
    envKey: "OPENROUTER_API_KEY",
    baseURL: "https://openrouter.ai/api/v1",
    name: "OpenRouter",
    active: false,
  },
};

// Provider fallback order — ONLY active providers are listed.  Currently
// just ["mistral"].  When the primary model is on Mistral, no fallback is
// attempted (single-provider mode).  Re-add a provider key here to
// re-enable cross-provider fallback for it.
const PROVIDER_FALLBACK_ORDER: string[] = ["mistral"];

// Default model slug for each provider (used when falling back).
// Only the active provider's default is meaningful; the muted entries
// are kept so the legacy code paths still resolve.
const PROVIDER_DEFAULT_MODEL: Record<string, string> = {
  mistral: "codestral-latest",
  groq: "codestral-latest",        // muted — remapped to Mistral
  gemini: "mistral-large-latest",  // muted — remapped to Mistral
  cerebras: "codestral-latest",    // muted — remapped to Mistral
  openrouter: "mistral-large-latest", // muted — remapped to Mistral
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
  // ── Mistral AI models (ACTIVE) ──────────────────────────────────
  // codestral-latest: purpose-built for code generation, 256k context —
  // the workhorse for the main coding step and the default for all
  // project types.
  "codestral-latest": {
    slug: "codestral-latest",
    label: "Codestral",
    provider: "mistral",
    modelId: "codestral-latest",
    note: "\u26a1 Fast & code-tuned",
  },
  // mistral-large-latest: strongest general-purpose reasoning — used for
  // the separate "software architect" planning step and offered as the
  // premium quality option in the picker.
  "mistral-large-latest": {
    slug: "mistral-large-latest",
    label: "Mistral Large",
    provider: "mistral",
    modelId: "mistral-large-latest",
    note: "\ud83d\udc8e Best quality",
  },
  // mistral-small-latest: cheap & fast — used for chat-title generation
  // and offered as a lightweight option.
  "mistral-small-latest": {
    slug: "mistral-small-latest",
    label: "Mistral Small",
    provider: "mistral",
    modelId: "mistral-small-latest",
    note: "\ud83d\ude80 Quick & cheap",
  },

  // ── LEGACY MODELS (muted, hidden from UI) ───────────────────────
  // Slugs kept here so resolveModelSlug() finds them without going
  // through the alias map.  All are marked `hidden: true` so they
  // never appear in the picker.  Their `provider` is left as the
  // original key for traceability — but since those providers are
  // removed from PROVIDER_FALLBACK_ORDER and their env keys are
  // optional, requests for these slugs route through
  // LEGACY_SLUG_ALIASES remapping (see below) to the active Mistral
  // equivalent BEFORE a client is constructed.
  "llama-3.3-70b": {
    slug: "llama-3.3-70b",
    label: "Llama 3.3 70B (legacy)",
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    hidden: true,
  },
  "qwen-3.6-27b": {
    slug: "qwen-3.6-27b",
    label: "Qwen 3.6 27B (legacy)",
    provider: "groq",
    modelId: "qwen/qwen3.6-27b",
    hidden: true,
  },
  "llama-3.1-8b": {
    slug: "llama-3.1-8b",
    label: "Llama 3.1 8B (legacy)",
    provider: "groq",
    modelId: "llama-3.1-8b-instant",
    hidden: true,
  },
  "gpt-oss-120b": {
    slug: "gpt-oss-120b",
    label: "GPT-OSS 120B (legacy)",
    provider: "groq",
    modelId: "openai/gpt-oss-120b",
    hidden: true,
  },
  "gpt-oss-20b": {
    slug: "gpt-oss-20b",
    label: "GPT-OSS 20B (legacy)",
    provider: "groq",
    modelId: "openai/gpt-oss-20b",
    hidden: true,
  },
  "gemini-2.5-flash": {
    slug: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (legacy)",
    provider: "gemini",
    modelId: "gemini-2.5-flash",
    hidden: true,
  },
  "gemini-2.5-pro": {
    slug: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro (legacy)",
    provider: "gemini",
    modelId: "gemini-2.5-pro",
    hidden: true,
  },
  "cerebras-llama-4-scout": {
    slug: "cerebras-llama-4-scout",
    label: "Llama 4 Scout (legacy)",
    provider: "cerebras",
    modelId: "llama-4-scout-17b-16e-instruct",
    hidden: true,
  },
  "cerebras-llama-4-maverick": {
    slug: "cerebras-llama-4-maverick",
    label: "Llama 4 Maverick (legacy)",
    provider: "cerebras",
    modelId: "llama-4-maverick-17b-128e-instruct",
    hidden: true,
  },
  "openrouter-deepseek-v3": {
    slug: "openrouter-deepseek-v3",
    label: "DeepSeek V3 (legacy)",
    provider: "openrouter",
    modelId: "deepseek/deepseek-chat-v3-0324:free",
    hidden: true,
  },
  "openrouter-qwen3-coder": {
    slug: "openrouter-qwen3-coder",
    label: "Qwen 3 Coder (legacy)",
    provider: "openrouter",
    modelId: "qwen/qwen3-coder-480b-a35b-instruct",
    hidden: true,
  },
};

// ---------- Public helpers ----------

/** Get all registry entries (optionally filtered to non-hidden).
 *
 * By default (hideHidden=true), hidden/legacy models are excluded.
 * The `requireApiKey` flag controls whether models whose provider
 * API key is missing are filtered out.  The UI picker MUST pass
 * `requireApiKey=false` so users always see the full model list —
 * key checking happens server-side when a stream is actually requested.
 *
 * Muted providers are always excluded when `requireApiKey=true` — a
 * muted provider with no key would otherwise pollute the available set.
 */
export function getAllModels(hideHidden = true, requireApiKey = false): ModelRegistryEntry[] {
  return Object.values(MODEL_REGISTRY).filter((m) => {
    if (m.hidden && hideHidden) return false;
    if (requireApiKey) {
      const provider = PROVIDERS[m.provider];
      if (!provider || !provider.active) return false;
      if (!process.env[provider.envKey]) return false;
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
 *
 * Resolution order:
 *   1. Direct registry hit.
 *   2. LEGACY_SLUG_ALIASES — every legacy slug (including the muted
 *      Groq / Gemini / Cerebras / OpenRouter slugs) is remapped to an
 *      active Mistral model so existing chats keep working without
 *      needing a DB migration.
 *   3. Unknown slug — return a synthetic entry on the active Mistral
 *      provider so the caller hits Mistral instead of a dead provider.
 */
export function resolveModelSlug(slug: string): ModelRegistryEntry {
  const entry = MODEL_REGISTRY[slug];
  if (entry) {
    // If the resolved entry is on a muted provider, remap to the
    // active Mistral equivalent via the alias table.  This is the
    // single chokepoint that keeps legacy DB rows working after
    // muting the four original providers.
    if (PROVIDERS[entry.provider] && !PROVIDERS[entry.provider].active) {
      const remapped = LEGACY_SLUG_ALIASES[slug];
      if (remapped && MODEL_REGISTRY[remapped]) {
        return MODEL_REGISTRY[remapped];
      }
    }
    return entry;
  }

  const aliased = LEGACY_SLUG_ALIASES[slug];
  if (aliased) {
    const resolved = MODEL_REGISTRY[aliased];
    if (resolved) return resolved;
  }

  return {
    slug,
    label: slug,
    provider: "mistral",
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

/**
 * Same as getAIClientForModel but returns undefined instead of throwing
 * when the provider API key is missing.  Useful for fallback loops where
 * you want to silently skip a provider.
 */
export function tryGetAIClientForModel(slug: string): OpenAI | undefined {
  const entry = resolveModelSlug(slug);
  const provider = PROVIDERS[entry.provider];
  if (!provider) return undefined;
  const apiKey = getProviderApiKey(entry.provider);
  if (!apiKey) return undefined;
  return new OpenAI({ apiKey, baseURL: provider.baseURL });
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
    // L4: tightened patterns — bare "service" and "500" were too broad and
    // matched unrelated substrings (e.g. "service account", port numbers).
    return (
      m.includes("429") ||
      m.includes("rate limit") ||
      m.includes("quota") ||
      /\b5\d\d\b/.test(m) || // any 5xx HTTP status as a word boundary
      m.includes("overloaded") ||
      m.includes("capacity") ||
      m.includes("service unavailable") ||
      m.includes("unavailable")
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
 * provider.  With the current single-active-provider setup
 * (PROVIDER_FALLBACK_ORDER = ["mistral"]) this always returns []
 * because there is no other active provider to fall back to.  The
 * circular-wrap logic is preserved so re-enabling a second provider
 * is a one-line change.
 */
function getFallbackProviders(primaryProviderKey: string): string[] {
  const idx = PROVIDER_FALLBACK_ORDER.indexOf(primaryProviderKey);
  if (idx === -1) {
    // Primary is on a muted provider (or unknown).  Fall back to every
    // active provider in order.
    return [...PROVIDER_FALLBACK_ORDER];
  }
  // Take everything after the primary, then wrap around to the beginning
  const after = PROVIDER_FALLBACK_ORDER.slice(idx + 1);
  const before = PROVIDER_FALLBACK_ORDER.slice(0, idx);
  return [...after, ...before];
}

/**
 * Get ALL available fallback model entries (active provider with an API
 * key configured), ordered by the provider fallback chain.  Skips the
 * primary model's provider since it already failed.
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
    if (!provider || !provider.active) continue;
    if (!getProviderApiKey(providerKey)) continue;

    const fallbackSlug = PROVIDER_DEFAULT_MODEL[providerKey];
    if (!fallbackSlug) continue;

    const entry = MODEL_REGISTRY[fallbackSlug];
    if (entry) results.push(entry);
  }

  return results;
}

/**
 * Return an ordered list of model slugs to try: primary first, then
 * all available fallback models from other providers.
 * Used by lib/generation.ts for its non-streaming fallback loop.
 */
export function getFallbackModelSlugs(primaryModelSlug: string): string[] {
  const primaryEntry = resolveModelSlug(primaryModelSlug);
  const slugs: string[] = [primaryEntry.slug];
  const fallbackEntries = getAllFallbackModels(primaryModelSlug);
  for (const entry of fallbackEntries) {
    // Avoid duplicates (e.g. if the primary model IS the default for
    // its provider and the fallback wraps around)
    if (!slugs.includes(entry.slug)) {
      slugs.push(entry.slug);
    }
  }
  return slugs;
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
//
// Every legacy slug — including the four muted providers' default
// models — is remapped to an active Mistral model.  This means an
// existing chat stored with `model = "llama-3.3-70b"` will, on the
// next streaming request, transparently run on `codestral-latest`
// with no DB migration required.
//
// Mapping rationale:
//   - Anything that was the "default / fast" workhorse (llama-3.3-70b,
//     gemini-2.5-flash, cerebras scout, qwen-3.6-27b) → codestral-latest
//     (the new default workhorse).
//   - Anything that was a "premium reasoning" model (gemini-2.5-pro,
//     openrouter-deepseek-v3, gpt-oss-120b, deepseek-v4-pro) →
//     mistral-large-latest (the new premium reasoning model).
//   - Anything that was a "small / cheap" model (llama-3.1-8b) →
//     mistral-small-latest (the new cheap model).
const LEGACY_SLUG_ALIASES: Record<string, string> = {
  // ── Remap our own (now-muted) registry slugs ────────────────────
  "llama-3.3-70b": "codestral-latest",
  "qwen-3.6-27b": "codestral-latest",
  "llama-3.1-8b": "mistral-small-latest",
  "gpt-oss-120b": "mistral-large-latest",
  "gpt-oss-20b": "codestral-latest",
  "gemini-2.5-flash": "codestral-latest",
  "gemini-2.5-pro": "mistral-large-latest",
  "cerebras-llama-4-scout": "codestral-latest",
  "cerebras-llama-4-maverick": "mistral-large-latest",
  "openrouter-deepseek-v3": "mistral-large-latest",
  "openrouter-qwen3-coder": "codestral-latest",

  // ── Old NVIDIA NIM IDs ──────────────────────────────────────────
  "z-ai/glm-5.2": "codestral-latest",
  "zai-org/GLM-4.6": "codestral-latest",
  "zai-org/GLM-5": "codestral-latest",
  "zai-org/GLM-5.1": "codestral-latest",
  "zai-org/GLM-5.2": "codestral-latest",
  "moonshotai/kimi-k2-instruct": "codestral-latest",
  "moonshotai/kimi-k2-thinking": "mistral-large-latest",
  "moonshotai/Kimi-K2.5": "codestral-latest",
  "moonshotai/Kimi-K2-Instruct-0905": "codestral-latest",
  "moonshotai/Kimi-K2.7-Code": "codestral-latest",
  "moonshotai/Kimi-K2.6": "mistral-large-latest",
  "nvidia/nemotron-3-ultra-550b-a55b": "mistral-large-latest",
  "qwen/qwen3-coder-480b-a35b-instruct": "codestral-latest",
  "Qwen/Qwen3-Coder-Next-FP8": "codestral-latest",
  "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8": "codestral-latest",
  "Qwen/Qwen2.5-Coder-32B-Instruct": "codestral-latest",
  "minimaxai/minimax-m2.7": "mistral-large-latest",
  "MiniMaxAI/MiniMax-M2.5": "mistral-large-latest",
  "MiniMaxAI/MiniMax-M2.7": "mistral-large-latest",
  "MiniMaxAI/MiniMax-M3": "mistral-large-latest",
  "Qwen/Qwen3.7-Max": "mistral-large-latest",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-FP8": "mistral-large-latest",
  "Qwen/Qwen3-235B-A22B-Instruct-2507-tput": "mistral-large-latest",
  "deepseek-ai/DeepSeek-V3": "mistral-large-latest",
  "deepseek-ai/DeepSeek-V3.1": "mistral-large-latest",
  "deepseek-ai/deepseek-v4-pro": "mistral-large-latest",
  "meta/llama-3.3-70b-instruct": "codestral-latest",
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": "codestral-latest",
  "openai/gpt-oss-120b": "mistral-large-latest",
  "openai/gpt-oss-20b": "codestral-latest",
  // Old cerebras-llama-70b slug (was a duplicate of Groq llama-3.3-70b)
  "cerebras-llama-70b": "codestral-latest",
  // Old deepseek-v3 slug (now namespaced under openrouter)
  "deepseek-v3": "mistral-large-latest",
  // Direct Groq model IDs (raw, not slugs)
  "llama-3.3-70b-versatile": "codestral-latest",
  "qwen/qwen3.6-27b": "codestral-latest",
  "llama-3.1-8b-instant": "mistral-small-latest",
};


// ---------- Static env-var access (webpack-compatible) ----------
//
// In Next.js standalone mode, process.env is empty at runtime.
// The next.config.ts env: block bakes values ONLY for references
// that webpack can statically analyze (e.g. process.env.MISTRAL_API_KEY).
// Dynamic access like process.env[variable] is NOT replaced and
// returns undefined at runtime.  This helper uses a switch statement
// so every branch is a static, analyzable reference.

function getProviderApiKey(providerKey: string): string | undefined {
  switch (providerKey) {
    case 'mistral':    return process.env.MISTRAL_API_KEY;
    case 'groq':       return process.env.GROQ_API_KEY;
    case 'gemini':     return process.env.GEMINI_API_KEY;
    case 'cerebras':   return process.env.CEREBRAS_API_KEY;
    case 'openrouter': return process.env.OPENROUTER_API_KEY;
    default: return undefined;
  }
}
export { PROVIDERS, PROVIDER_FALLBACK_ORDER, buildProviderErrorMessage };
