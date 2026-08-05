import { MODELS, resolveModel } from "@/lib/constants";

// Deterministic model routing for the project-creation flow: the user never
// picks a model directly, so this maps each database-backed project type
// (by slug) to the Groq model best suited to it, with a description
// keyword override for cases that clearly need more reasoning headroom.
// This is intentionally NOT an extra LLM call — it must be instant, free,
// and side-effect-free so it can run inline in the create-project request.
//
// Routing strategy:
//   website / landing-page / blog / portfolio  → Llama 3.3 70B (fast, high quality)
//   dashboard-admin-panel / api-backend-service → Llama 3.3 70B (strongest reasoning)
//   web-application / ecommerce-store          → Qwen 3.6 27B (good balance)
//   game                                       → Llama 3.3 70B (complex logic)
//   chrome-extension / mobile apps              → Qwen 3.6 27B (moderate complexity)
const TYPE_MODEL: Record<string, string> = {
  website: "llama-3.3-70b-versatile",
  "web-application": "qwen/qwen3.6-27b",
  "landing-page": "llama-3.3-70b-versatile",
  portfolio: "llama-3.3-70b-versatile",
  "ecommerce-store": "qwen/qwen3.6-27b",
  blog: "llama-3.3-70b-versatile",
  "dashboard-admin-panel": "llama-3.3-70b-versatile",
  "android-application": "llama-3.3-70b-versatile",
  "ios-application": "llama-3.3-70b-versatile",
  "chrome-extension": "qwen/qwen3.6-27b",
  "api-backend-service": "llama-3.3-70b-versatile",
  game: "llama-3.3-70b-versatile",
};

// Signals in the description that warrant the strongest reasoning model
// regardless of the project type's default (complex state, integrations,
// or real-time behavior benefit from the extra reasoning budget).
const COMPLEXITY_KEYWORDS =
  /\b(real-?time|multiplayer|websocket|payment|stripe|authentication|machine learning|recommendation engine|3d|physics engine|animation-heavy|workflow engine|state machine|drag[- ]and[- ]drop builder)\b/i;

const STRONGEST_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_MODEL = MODELS.find((m) => !m.hidden)?.value ?? MODELS[0].value;

export function chooseModelForProject(
  projectTypeSlug: string,
  description: string,
): string {
  const base = TYPE_MODEL[projectTypeSlug] ?? DEFAULT_MODEL;

  if (COMPLEXITY_KEYWORDS.test(description) && base !== STRONGEST_MODEL) {
    return resolveModel(STRONGEST_MODEL);
  }

  return resolveModel(base);
}
