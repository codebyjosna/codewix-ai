import { MODEL_REGISTRY, getAllModels } from "./ai-provider";

// Deterministic model routing for the project-creation flow: the user never
// picks a model directly, so this maps each database-backed project type
// (by slug) to the model slug best suited to it, with a description
// keyword override for cases that clearly need more reasoning headroom.
// This is intentionally NOT an extra LLM call — it must be instant, free,
// and side-effect-free so it can run inline in the create-project request.

// codestral-latest (Mistral AI) is ALWAYS the default model for ALL project
// types.  It is purpose-built for code generation, runs at ~100-150 tok/s
// (2-3x faster than mistral-large-latest), and produces high-quality React/
// Tailwind code.  Using it exclusively also avoids the Lambda timeout issue
// that occurs when mistral-large-latest + max_tokens=20000 pushes generation
// past the 300s Lambda maxDuration.
//
// The four legacy providers (Groq / Gemini / Cerebras / OpenRouter) are
// muted — see lib/ai-provider.ts.
const DEFAULT_MODEL = "codestral-latest";

const TYPE_MODEL: Record<string, string> = {
  website: DEFAULT_MODEL,
  "web-application": DEFAULT_MODEL,
  "landing-page": DEFAULT_MODEL,
  portfolio: DEFAULT_MODEL,
  "ecommerce-store": DEFAULT_MODEL,
  blog: DEFAULT_MODEL,
  "dashboard-admin-panel": DEFAULT_MODEL,
  "android-application": DEFAULT_MODEL,
  "ios-application": DEFAULT_MODEL,
  "chrome-extension": DEFAULT_MODEL,
  "api-backend-service": DEFAULT_MODEL,
  game: DEFAULT_MODEL,
};

export function chooseModelForProject(
  projectTypeSlug: string,
  description: string,
): string {
  // Always use codestral-latest — it's the fastest, code-tuned model.
  // The complexity check was removed because codestral handles complex
  // code well, and mistral-large-latest is too slow for the Lambda
  // 300s timeout (50 tok/s × 10k tokens = 200s, cutting it close).
  const available = getAllModels(true, true);
  const availableSlugs = new Set(available.map((m) => m.slug));

  let base = TYPE_MODEL[projectTypeSlug] ?? DEFAULT_MODEL;

  // If the preferred model is in the registry, use it regardless of key.
  // The fallback chain in the stream route will handle missing keys.
  if (base in MODEL_REGISTRY) return base;

  // If somehow the base isn't in the registry (corrupt data),
  // fall back to the first available model that has a key.
  if (availableSlugs.size > 0) return available[0].slug;

  return DEFAULT_MODEL;
}
