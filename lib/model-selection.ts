import { MODELS, resolveModel } from "@/lib/constants";

// Deterministic model routing for the project-creation flow: the user never
// picks a model directly, so this maps each database-backed project type
// (by slug) to the NVIDIA NIM model best suited to it, with a description
// keyword override for cases that clearly need more reasoning headroom.
// This is intentionally NOT an extra LLM call - it must be instant, free,
// and side-effect-free so it can run inline in the create-project request.
const TYPE_MODEL: Record<string, string> = {
  website: "z-ai/glm-5.2",
  "web-application": "moonshotai/kimi-k2-instruct",
  "landing-page": "z-ai/glm-5.2",
  portfolio: "z-ai/glm-5.2",
  "ecommerce-store": "moonshotai/kimi-k2-instruct",
  blog: "z-ai/glm-5.2",
  "dashboard-admin-panel": "moonshotai/kimi-k2-thinking",
  "android-application": "moonshotai/kimi-k2-thinking",
  "ios-application": "moonshotai/kimi-k2-thinking",
  "chrome-extension": "moonshotai/kimi-k2-instruct",
  "api-backend-service": "moonshotai/kimi-k2-thinking",
  game: "nvidia/nemotron-3-ultra-550b-a55b",
};

// Signals in the description that warrant the strongest reasoning model
// regardless of the project type's default (complex state, integrations,
// or real-time behavior benefit from the extra reasoning budget).
const COMPLEXITY_KEYWORDS =
  /\b(real-?time|multiplayer|websocket|payment|stripe|authentication|machine learning|recommendation engine|3d|physics engine|animation-heavy|workflow engine|state machine|drag[- ]and[- ]drop builder)\b/i;

const STRONGEST_MODEL = "moonshotai/kimi-k2-thinking";
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
