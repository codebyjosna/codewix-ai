// Real streaming smoke test against Mistral AI through the actual app code path.
// Verifies:
//   1. resolveModelSlug() maps each active slug correctly
//   2. resolveModelSlug() remaps legacy slugs to active Mistral models
//   3. getAIClientForModel() returns a working OpenAI client pointed at Mistral
//   4. The OpenAI SDK streaming chat completion actually works end-to-end
//   5. stream_options.include_usage is accepted (the route uses it)
//   6. getAllFallbackModels returns [] for a Mistral primary (no cross-provider fallback)
//   7. A legacy slug ("llama-3.3-70b") transparently routes to codestral-latest
//
// Loads .env from the repo root before running.  Exits non-zero on any failure.
//
//   pnpm tsx scripts/smoke-test-mistral.ts

import * as fs from "node:fs";
import * as path from "node:path";

// ── Load .env manually (the script runs outside Next.js) ─────────────
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
}

// Now import the app's actual AI provider code.
import {
  resolveModelSlug,
  getAIClientForModel,
  getProviderModelId,
  getProviderName,
  getAllFallbackModels,
  getFallbackModelSlugs,
  AIProviderError,
} from "../lib/ai-provider";
import { PLANNING_MODEL, TITLE_MODEL } from "../lib/constants";
import { chooseModelForProject } from "../lib/model-selection";
import type OpenAI from "openai";

// ── Tiny test framework ──────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];

function ok(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name}${detail ? " — " + detail : ""}`);
    failed++;
    failures.push(name);
  }
}

function eq<T>(name: string, actual: T, expected: T) {
  const cond = actual === expected;
  ok(name, cond, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// ── Run a real streaming chat completion through the OpenAI SDK ──────
async function streamChat(
  ai: OpenAI,
  modelId: string,
  prompt: string,
  opts: { maxTokens?: number; streamOptions?: boolean } = {},
): Promise<{ content: string; usage: any | undefined; finish: string | null }> {
  const baseParams = {
    model: modelId,
    messages: [
      { role: "system" as const, content: "Reply in one short sentence." },
      { role: "user" as const, content: prompt },
    ],
    temperature: 0.2,
    max_tokens: opts.maxTokens ?? 32,
  };
  const stream = opts.streamOptions
    ? ai.chat.completions.stream({
        ...baseParams,
        stream_options: { include_usage: true },
      })
    : ai.chat.completions.stream(baseParams);

  let content = "";
  stream.on("content", (delta: string) => {
    content += delta;
  });

  const finalText = (await stream.finalContent()) ?? "";
  const usage = await stream.totalUsage().catch(() => undefined);
  const completion = await stream.finalChatCompletion().catch(() => undefined);
  const finish = completion?.choices?.[0]?.finish_reason ?? null;
  return { content: finalText, usage, finish };
}

// ── Tests ────────────────────────────────────────────────────────────
async function main() {
  console.log("═══ Mistral AI integration smoke test ═══\n");

  // 1. Env var present
  console.log("→ Section 1: environment");
  ok(
    "MISTRAL_API_KEY is set",
    !!process.env.MISTRAL_API_KEY,
    "MISTRAL_API_KEY missing from env (check .env)",
  );

  // 2. Active slugs resolve to Mistral
  console.log("\n→ Section 2: slug resolution for active models");
  eq(
    'resolveModelSlug("codestral-latest").provider',
    resolveModelSlug("codestral-latest").provider,
    "mistral",
  );
  eq(
    'resolveModelSlug("codestral-latest").modelId',
    resolveModelSlug("codestral-latest").modelId,
    "codestral-latest",
  );
  eq(
    'resolveModelSlug("mistral-large-latest").provider',
    resolveModelSlug("mistral-large-latest").provider,
    "mistral",
  );
  eq(
    'resolveModelSlug("mistral-small-latest").provider',
    resolveModelSlug("mistral-small-latest").provider,
    "mistral",
  );

  // 3. Legacy slugs remap to active Mistral equivalents
  console.log("\n→ Section 3: legacy slug remapping (backward compat)");
  eq(
    'resolveModelSlug("llama-3.3-70b").slug (legacy default)',
    resolveModelSlug("llama-3.3-70b").slug,
    "codestral-latest",
  );
  eq(
    'resolveModelSlug("llama-3.3-70b").provider',
    resolveModelSlug("llama-3.3-70b").provider,
    "mistral",
  );
  eq(
    'resolveModelSlug("gemini-2.5-pro").slug (legacy premium)',
    resolveModelSlug("gemini-2.5-pro").slug,
    "mistral-large-latest",
  );
  eq(
    'resolveModelSlug("llama-3.1-8b").slug (legacy small)',
    resolveModelSlug("llama-3.1-8b").slug,
    "mistral-small-latest",
  );
  eq(
    'resolveModelSlug("openrouter-deepseek-v3").slug (legacy reasoning)',
    resolveModelSlug("openrouter-deepseek-v3").slug,
    "mistral-large-latest",
  );

  // 4. Constants point at Mistral
  console.log("\n→ Section 4: constants + model-selection");
  eq("PLANNING_MODEL", PLANNING_MODEL, "mistral-large-latest");
  eq("TITLE_MODEL", TITLE_MODEL, "mistral-small-latest");
  eq(
    'chooseModelForProject("website", "simple landing")',
    chooseModelForProject("website", "simple landing page"),
    "codestral-latest",
  );
  eq(
    'chooseModelForProject("web-application", "with auth")',
    chooseModelForProject("web-application", "real-time multiplayer websocket game"),
    "mistral-large-latest",
  );

  // 5. Fallback chain: Mistral primary → no cross-provider fallback
  console.log("\n→ Section 5: fallback chain (single active provider)");
  const fallbacks = getAllFallbackModels("codestral-latest");
  ok(
    'getAllFallbackModels("codestral-latest") === []',
    Array.isArray(fallbacks) && fallbacks.length === 0,
    `got ${JSON.stringify(fallbacks.map((m) => m.slug))}`,
  );
  const slugs = getFallbackModelSlugs("codestral-latest");
  ok(
    'getFallbackModelSlugs("codestral-latest") === ["codestral-latest"]',
    Array.isArray(slugs) && slugs.length === 1 && slugs[0] === "codestral-latest",
    `got ${JSON.stringify(slugs)}`,
  );

  // 6. getProviderName + getProviderModelId
  console.log("\n→ Section 6: provider metadata helpers");
  eq('getProviderName("codestral-latest")', getProviderName("codestral-latest"), "Mistral AI");
  eq('getProviderModelId("codestral-latest")', getProviderModelId("codestral-latest"), "codestral-latest");
  eq(
    'getProviderName("llama-3.3-70b") (legacy remapped)',
    getProviderName("llama-3.3-70b"),
    "Mistral AI",
  );

  // 7. Real streaming round-trips through the OpenAI SDK
  console.log("\n→ Section 7: real streaming chat completions (via OpenAI SDK)");
  const cases: Array<{ slug: string; prompt: string; expectContains?: string }> = [
    { slug: "codestral-latest", prompt: "Reply with the single word: ok", expectContains: "ok" },
    { slug: "mistral-large-latest", prompt: "Reply with the single word: hello" },
    { slug: "mistral-small-latest", prompt: "Reply with the single word: hi" },
    // Legacy slug — must transparently route to codestral-latest on Mistral
    { slug: "llama-3.3-70b", prompt: "Reply with the single word: legacy", expectContains: "legacy" },
  ];

  for (const c of cases) {
    const entry = resolveModelSlug(c.slug);
    const ai = getAIClientForModel(c.slug);
    const baseURL = (ai as unknown as { baseURL: string | undefined }).baseURL;
    ok(
      `getAIClientForModel("${c.slug}") points at Mistral`,
      typeof baseURL === "string" && baseURL.includes("api.mistral.ai"),
      `baseURL=${baseURL}`,
    );
    try {
      const result = await streamChat(ai, entry.modelId, c.prompt, {
        maxTokens: 16,
        streamOptions: true,
      });
      ok(
        `stream "${c.slug}" → "${entry.slug}" produced content`,
        !!result.content && result.content.trim().length > 0,
        `content=${JSON.stringify(result.content)}`,
      );
      ok(
        `stream "${c.slug}" finish_reason is "stop"`,
        result.finish === "stop",
        `finish=${result.finish}`,
      );
      ok(
        `stream "${c.slug}" returned usage (stream_options.include_usage works)`,
        !!result.usage && typeof result.usage.completion_tokens === "number",
        `usage=${JSON.stringify(result.usage)}`,
      );
      if (c.expectContains) {
        ok(
          `stream "${c.slug}" reply contains "${c.expectContains}"`,
          result.content.toLowerCase().includes(c.expectContains.toLowerCase()),
          `content=${JSON.stringify(result.content)}`,
        );
      }
    } catch (err) {
      ok(`stream "${c.slug}" completed without throwing`, false, (err as Error).message);
    }
  }

  // 8. Missing-key error path (temporarily blank the env var)
  console.log("\n→ Section 8: missing-key error path");
  const savedKey = process.env.MISTRAL_API_KEY;
  delete process.env.MISTRAL_API_KEY;
  try {
    getAIClientForModel("codestral-latest");
    ok("getAIClientForModel throws when MISTRAL_API_KEY is missing", false, "did not throw");
  } catch (err) {
    ok(
      "getAIClientForModel throws AIProviderError MISSING_API_KEY",
      err instanceof AIProviderError && err.code === "MISSING_API_KEY",
      `err=${(err as Error).message}`,
    );
  }
  process.env.MISTRAL_API_KEY = savedKey;

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════");
  console.log(`  ✓ passed: ${passed}`);
  console.log(`  ✗ failed: ${failed}`);
  if (failures.length > 0) {
    console.log("  failing tests:");
    for (const f of failures) console.log(`    - ${f}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(2);
});
