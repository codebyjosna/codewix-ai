import { MODEL_REGISTRY, getAllModels } from "./ai-provider";

// Deterministic model routing for the project-creation flow: the user never
// picks a model directly, so this maps each database-backed project type
// (by slug) to the model slug best suited to it, with a description
// keyword override for cases that clearly need more reasoning headroom.
// This is intentionally NOT an extra LLM call — it must be instant, free,
// and side-effect-free so it can run inline in the create-project request.

// llama-3.3-70b (Groq) is ALWAYS the default model, regardless of whether
// the GROQ_API_KEY is available at build time.  Key checking only happens
// at stream-request time (the fallback chain handles missing keys).
const DEFAULT_MODEL = "llama-3.3-70b";

const TYPE_MODEL: Record<string, string> = {
  website: DEFAULT_MODEL,
  "web-application": "qwen-3.6-27b",
  "landing-page": DEFAULT_MODEL,
  portfolio: DEFAULT_MODEL,
  "ecommerce-store": "qwen-3.6-27b",
  blog: DEFAULT_MODEL,
  "dashboard-admin-panel": DEFAULT_MODEL,
  "android-application": DEFAULT_MODEL,
  "ios-application": DEFAULT_MODEL,
  "chrome-extension": "qwen-3.6-27b",
  "api-backend-service": DEFAULT_MODEL,
  game: DEFAULT_MODEL,
};

// Signals in the description that warrant the strongest reasoning model.
// L1: now actually used — when matched, upgrades the base model to a stronger
// reasoning model if one is registered.
const COMPLEXITY_KEYWORDS =
  /\b(real-?time|multiplayer|websocket|payment|stripe|authentication|machine learning|recommendation engine|3d|physics engine|animation-heavy|workflow engine|state machine|drag[- ]and[- ]drop builder)\b/i;

// Models preferred for complex/realtime work (in priority order).
const COMPLEX_MODEL_PREFERENCE = [
  "gemini-2.5-pro",
  "openrouter-deepseek-v3",
  "qwen-3.6-27b",
  "llama-3.3-70b",
];

export function chooseModelForProject(
  projectTypeSlug: string,
  description: string,
): string {
  // Always prefer llama-3.3-70b (Groq) as the default.
  // Only override for specific project types that benefit from Qwen.
  const available = getAllModels(true, true);
  const availableSlugs = new Set(available.map((m) => m.slug));

  let base = TYPE_MODEL[projectTypeSlug] ?? DEFAULT_MODEL;

  // L1: if the description signals high complexity, upgrade to a stronger
  // reasoning model (first available from the preference list).
  if (description && COMPLEXITY_KEYWORDS.test(description)) {
    const complex = COMPLEX_MODEL_PREFERENCE.find((s) => s in MODEL_REGISTRY);
    if (complex) base = complex;
  }

  // If the preferred model is in the registry, use it regardless of key.
  // The fallback chain in the stream route will handle missing keys.
  if (base in MODEL_REGISTRY) return base;

  // If somehow the base isn't in the registry (corrupt data),
  // fall back to the first available model that has a key.
  if (availableSlugs.size > 0) return available[0].slug;

  return DEFAULT_MODEL;
}
