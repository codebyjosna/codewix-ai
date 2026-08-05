import OpenAI from "openai";

// ──────────────────────────────────────────────────────────────────────
// AI client factory
//
// This is the SINGLE entry-point that every server-side file calls to get
// an OpenAI client.  It delegates to the multi-provider registry in
// ai-provider.ts, which picks the correct API key + base URL based on the
// model slug.
//
// All API keys are server-side only (process.env) — never exposed to client.
// ──────────────────────────────────────────────────────────────────────

import {
  getAIClientForModel,
  resolveModelSlug,
  getProviderModelId,
  getProviderName,
} from "./ai-provider";

/**
 * Get an OpenAI client configured for the provider that backs `modelSlug`.
 *
 * If `modelSlug` is a legacy model ID (stored in old DB rows), it is
 * automatically resolved via the alias map in ai-provider.ts.
 */
export function getAIClient(modelSlug?: string): OpenAI {
  if (!modelSlug) {
    return getAIClientForModel("llama-3.3-70b");
  }
  return getAIClientForModel(modelSlug);
}

/** Resolve a slug (or legacy ID) to the actual provider-level model ID. */
export { getProviderModelId as resolveModel };

/** Get the human-readable provider name (for logging only). */
export { getProviderName };

/** Resolve a slug to the full registry entry. */
export { resolveModelSlug };

/** Get a client for a specific model slug. */
export { getAIClientForModel };

/** Get the raw model ID for a slug. */
export { getProviderModelId };
