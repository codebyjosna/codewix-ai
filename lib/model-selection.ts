import { resolveModelSlug } from "@/lib/ai-provider";
import { getAllModels } from "@/lib/ai-provider";

// Deterministic model routing for the project-creation flow: the user never
// picks a model directly, so this maps each database-backed project type
// (by slug) to the model slug best suited to it, with a description
// keyword override for cases that clearly need more reasoning headroom.
// This is intentionally NOT an extra LLM call — it must be instant, free,
// and side-effect-free so it can run inline in the create-project request.
//
// IMPORTANT: All values here are MODEL SLUGS (e.g. "llama-3.3-70b"),
// NOT provider-level model IDs.  The ai-provider registry handles the
// mapping from slug → provider → actual model ID.
const TYPE_MODEL: Record<string, string> = {
  website: "llama-3.3-70b",
  "web-application": "qwen-3.6-27b",
  "landing-page": "llama-3.3-70b",
  portfolio: "llama-3.3-70b",
  "ecommerce-store": "qwen-3.6-27b",
  blog: "llama-3.3-70b",
  "dashboard-admin-panel": "llama-3.3-70b",
  "android-application": "llama-3.3-70b",
  "ios-application": "llama-3.3-70b",
  "chrome-extension": "qwen-3.6-27b",
  "api-backend-service": "llama-3.3-70b",
  game: "llama-3.3-70b",
};

// Signals in the description that warrant the strongest reasoning model
// regardless of the project type's default (complex state, integrations,
// or real-time behavior benefit from the extra reasoning budget).
const COMPLEXITY_KEYWORDS =
  /\b(real-?time|multiplayer|websocket|payment|stripe|authentication|machine learning|recommendation engine|3d|physics engine|animation-heavy|workflow engine|state machine|drag[- ]and[- ]drop builder)\b/i;

const STRONGEST_MODEL = "llama-3.3-70b";
const DEFAULT_MODEL = getAllModels(true)[0]?.slug ?? "llama-3.3-70b";

export function chooseModelForProject(
  projectTypeSlug: string,
  description: string,
): string {
  const base = TYPE_MODEL[projectTypeSlug] ?? DEFAULT_MODEL;

  if (COMPLEXITY_KEYWORDS.test(description) && base !== STRONGEST_MODEL) {
    return STRONGEST_MODEL;
  }

  return base;
}
