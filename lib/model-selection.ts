import { MODEL_REGISTRY, getAllModels } from "./ai-provider";

// Deterministic model routing for the project-creation flow: the user never
// picks a model directly, so this maps each database-backed project type
// (by slug) to the model slug best suited to it, with a description
// keyword override for cases that clearly need more reasoning headroom.
// This is intentionally NOT an extra LLM call — it must be instant, free,
// and side-effect-free so it can run inline in the create-project request.

// codestral-latest (Mistral AI) is ALWAYS the default model, regardless of
// whether the MISTRAL_API_KEY is available at build time.  Key checking
// only happens at stream-request time (the fallback chain handles missing
// keys).  The four legacy providers (Groq / Gemini / Cerebras / OpenRouter)
// are muted — see lib/ai-provider.ts.
const DEFAULT_MODEL = "codestral-latest";

const TYPE_MODEL: Record<string, string> = {
  website: DEFAULT_MODEL,
  // Web apps with state + interactivity get the stronger reasoning model.
  "web-application": "mistral-large-latest",
  "landing-page": DEFAULT_MODEL,
  portfolio: DEFAULT_MODEL,
  "ecommerce-store": "mistral-large-latest",
  blog: DEFAULT_MODEL,
  "dashboard-admin-panel": DEFAULT_MODEL,
  "android-application": DEFAULT_MODEL,
  "ios-application": DEFAULT_MODEL,
  "chrome-extension": "mistral-large-latest",
  "api-backend-service": DEFAULT_MODEL,
  game: DEFAULT_MODEL,
};

// Signals in the description that warrant the strongest reasoning model.
// When matched, upgrades the base model to mistral-large-latest.
const COMPLEXITY_KEYWORDS =
  /\b(real-?time|multiplayer|websocket|payment|stripe|authentication|machine learning|recommendation engine|3d|physics engine|animation-heavy|workflow engine|state machine|drag[- ]and[- ]drop builder)\b/i;

// Models preferred for complex/realtime work (in priority order).
// All are on the active Mistral provider — the muted providers are
// intentionally absent.
const COMPLEX_MODEL_PREFERENCE = [
  "mistral-large-latest",
  "codestral-latest",
  "mistral-small-latest",
];

export function chooseModelForProject(
  projectTypeSlug: string,
  description: string,
): string {
  // Always prefer codestral-latest (Mistral) as the default.
  // Only override for specific project types that benefit from
  // mistral-large-latest's stronger reasoning.
  const available = getAllModels(true, true);
  const availableSlugs = new Set(available.map((m) => m.slug));

  let base = TYPE_MODEL[projectTypeSlug] ?? DEFAULT_MODEL;

  // If the description signals high complexity, upgrade to a stronger
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
