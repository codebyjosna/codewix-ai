import OpenAI from "openai";
import {
  getProviderModelId,
  getFallbackModelSlugs,
  tryGetAIClientForModel,
  getProviderName,
} from "./ai-provider";
import { PLANNING_MODEL } from "./constants";
import {
  getMainCodingPrompt,
  softwareArchitectPrompt,
} from "./prompts";
import {
  DEFAULT_PROMPT_CONFIG,
  INLINE_PLAN_INSTRUCTION,
  buildMinimalCodingPrompt,
  type PromptConfig,
} from "./prompt-config";
import { extractAllCodeBlocks } from "./utils";

export type GeneratedFile = {
  path: string;
  content: string;
};

export type ArchMode = "separate" | "none" | "inline";

export type PromptVersion =
  | "current-v0"
  | "current-v0-plan-v2"
  | "minimal-v1"
  | "minimal-v2"
  | "minimal-v3"
  | "minimal-v4"
  | "minimal-v5"
  | "minimal-v6"
  | "minimal-v7"
  | "minimal-v3b"
  | "minimal-v8"
  | "minimal-v9"
  | "minimal-v10"
  | "minimal-v11";

export type GenerateAppConfig = {
  promptVersion?: PromptVersion;
  archMode?: ArchMode;
  temperature?: number;
  maxTokens?: number;
  promptConfig?: PromptConfig;
};

export type GenerateAppResult = {
  files: GeneratedFile[];
  rawText: string;
  plan: string;
  promptVersion: PromptVersion;
  archMode: ArchMode;
  sampling: {
    temperature: number;
    maxTokens: number;
  };
  timing: {
    firstTokenMs: number;
    totalGenerationMs: number;
  };
  tokens: {
    input: number;
    output: number;
  };
};

type TokenUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
};

export async function generateApp(
  prompt: string,
  model: string,
  config: GenerateAppConfig = {},
): Promise<GenerateAppResult> {
  const promptVersion = config.promptVersion ?? "current-v0";
  const archMode = config.archMode ?? "separate";
  const temperature = config.temperature ?? 0.4;

  const maxTokens =
    config.maxTokens ??
    (archMode === "separate" || archMode === "inline" ? 13000 : 9000);

  if (
    promptVersion !== "current-v0" &&
    promptVersion !== "current-v0-plan-v2" &&
    promptVersion !== "minimal-v1" &&
    promptVersion !== "minimal-v2" &&
    promptVersion !== "minimal-v3" &&
    promptVersion !== "minimal-v4" &&
    promptVersion !== "minimal-v5" &&
    promptVersion !== "minimal-v6" &&
   promptVersion !== "minimal-v7" &&
   promptVersion !== "minimal-v3b" &&
   promptVersion !== "minimal-v8" &&
   promptVersion !== "minimal-v9" &&
   promptVersion !== "minimal-v10" &&
   promptVersion !== "minimal-v11"
  ) {
    throw new Error(`Unsupported promptVersion: ${promptVersion}`);
  }

  if (
    archMode !== "separate" &&
    archMode !== "none" &&
    archMode !== "inline"
  ) {
    throw new Error(`Unsupported archMode: ${archMode}`);
  }

  const startedAt = performance.now();

  // archMode "none" mirrors the production default (quality "low"): the raw
  // user prompt goes straight to the coding model with no planning call.
  let plan = prompt;
  let planUsage: TokenUsage | undefined;

  // archMode "inline" behaves like "none" (no planning API call; the raw
  // user prompt is the user message) but adds a short instruction to plan
  // internally while keeping the response code-only.
  if (archMode === "separate") {
    // Planning step — try with fallback like the streaming route
    const planModels = getFallbackModelSlugs(PLANNING_MODEL);
    let planDone = false;
    for (const planSlug of planModels) {
      const planAi = tryGetAIClientForModel(planSlug);
      if (!planAi) continue;
      const planningModelId = getProviderModelId(planSlug);
      try {
        const planResponse = await planAi.chat.completions.create({
          model: planningModelId,
          messages: [
            { role: "system", content: softwareArchitectPrompt },
            { role: "user", content: prompt },
          ],
          temperature,
          max_tokens: 3000,
        });
        plan = planResponse.choices[0].message?.content ?? prompt;
        planUsage = planResponse.usage ?? undefined;
        planDone = true;
        break;
      } catch (err) {
        console.error(`[generation] Planning model ${planSlug} failed:`, err);
        continue;
      }
    }
    if (!planDone) {
      console.error("[generation] All planning models failed, using raw prompt");
    }
  }

  // Coding step — try with fallback like the streaming route.
  // M7: wrap the actual stream consumption in try/catch so transient
  // streaming failures fall through to the next provider (the previous code
  // only checked for available API keys, then broke immediately).
  let firstTokenMs = 0;

  const codingModels = getFallbackModelSlugs(model);
  const codingErrors: string[] = [];

  // Resolve the system prompt once (independent of provider).
  const systemPrompt = resolveSystemPrompt(promptVersion, config, archMode);

  let files: { path: string; content: string }[] = [];
  let rawText = "";
  let usedModelSlug = "";
  let resolvedModelId = "";

  for (const modelSlug of codingModels) {
    const client = tryGetAIClientForModel(modelSlug);
    if (!client) continue;
    resolvedModelId = getProviderModelId(modelSlug);
    usedModelSlug = modelSlug;
    console.error(
      `[generation] Trying ${getProviderName(usedModelSlug)} (${resolvedModelId}) for coding`,
    );

    try {
      const result = await tryCodingStream(client, resolvedModelId, systemPrompt, plan, temperature, maxTokens);
      files = result.files;
      rawText = result.rawText;
      firstTokenMs = result.firstTokenMs;
      break; // success
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      codingErrors.push(`${usedModelSlug}: ${msg}`);
      console.warn(`[generation] ${usedModelSlug} failed, trying next:`, msg);
      firstTokenMs = 0;
      continue;
    }
  }

  if (!usedModelSlug) {
    throw new Error(
      `No AI provider available for model "${model}". Tried: ${codingModels.join(", ")}`,
    );
  }
  if (codingErrors.length > 0 && files.length === 0) {
    throw new Error(
      `All coding providers failed: ${codingErrors.join(" | ")}`,
    );
  }


  // (systemPrompt already resolved above via resolveSystemPrompt and passed
  //  into tryCodingStream which handled the per-provider stream + the
  //  stream_options retry on actual consumption — M8.)
  const totalGenerationMs = performance.now() - startedAt;

  return {
    files,
    rawText,
    plan,
    promptVersion,
    archMode,
    sampling: {
      temperature,
      maxTokens,
    },
    timing: {
      firstTokenMs,
      totalGenerationMs,
    },
    tokens: {
      input: planUsage?.prompt_tokens ?? 0,
      output: planUsage?.completion_tokens ?? 0,
    },
  };
}

// Helper: resolve the coding system prompt based on promptVersion + config.
function resolveSystemPrompt(
  promptVersion: string,
  config: { promptConfig?: PromptConfig },
  archMode: string,
): string {
  const minimalVariant =
    promptVersion === "minimal-v2"
      ? "v2"
      : promptVersion === "minimal-v3"
        ? "v3"
        : promptVersion === "minimal-v4"
          ? "v4"
          : promptVersion === "minimal-v5"
            ? "v5"
            : promptVersion === "minimal-v6"
              ? "v6"
              : promptVersion === "minimal-v7"
                ? "v7"
                : promptVersion === "minimal-v3b"
                  ? "v3b"
                  : promptVersion === "minimal-v8"
                    ? "v8"
                    : promptVersion === "minimal-v9"
                      ? "v9"
                      : promptVersion === "minimal-v10"
                        ? "v10"
                        : promptVersion === "minimal-v11"
                          ? "v11"
                          : null;

  const isMinimal =
    promptVersion === "minimal-v1" ||
    promptVersion === "minimal-v2" ||
    promptVersion === "minimal-v3" ||
    promptVersion === "minimal-v4" ||
    promptVersion === "minimal-v5" ||
    promptVersion === "minimal-v6" ||
    promptVersion === "minimal-v7" ||
    promptVersion === "minimal-v3b" ||
    promptVersion === "minimal-v8" ||
    promptVersion === "minimal-v9" ||
    promptVersion === "minimal-v10" ||
    promptVersion === "minimal-v11";

  let systemPrompt = isMinimal
    ? buildMinimalCodingPrompt(
        minimalVariant
          ? {
              ...(config.promptConfig ?? DEFAULT_PROMPT_CONFIG),
              promptVariant: minimalVariant as never,
              ...(promptVersion === "minimal-v9" ||
              promptVersion === "minimal-v10" ||
              promptVersion === "minimal-v11"
                ? { uiLibrary: "baseui" as const }
                : {}),
            }
          : config.promptConfig ?? DEFAULT_PROMPT_CONFIG,
      )
    : getMainCodingPrompt();

  if (archMode === "inline") {
    systemPrompt += "\n\n" + INLINE_PLAN_INSTRUCTION;
  }
  return systemPrompt;
}

// Helper: try to run the coding stream for a single provider.
// M8: the stream_options retry wraps the actual stream CONSUMPTION
// (finalContent), not the stream() call — because the OpenAI SDK's stream()
// returns synchronously and API rejections surface at finalContent().
interface CodingStreamResult {
  files: { path: string; content: string }[];
  rawText: string;
  firstTokenMs: number;
}

async function tryCodingStream(
  ai: OpenAI,
  modelId: string,
  systemPrompt: string,
  plan: string,
  temperature: number,
  maxTokens: number,
): Promise<CodingStreamResult> {
  const codingStartedAt = performance.now();
  let firstTokenMs = 0;

  const baseParams = {
    model: modelId,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: plan },
    ],
    temperature,
    max_tokens: maxTokens,
  };

  // Try with stream_options first.
  let stream = ai.chat.completions.stream({
    ...baseParams,
    stream_options: { include_usage: true },
  });

  stream.on("content", (delta: string) => {
    if (!firstTokenMs && delta.length > 0) {
      firstTokenMs = performance.now() - codingStartedAt;
    }
  });

  let rawText: string;
  try {
    rawText = (await stream.finalContent()) ?? "";
  } catch (err) {
    // M8: if the provider rejected stream_options, the error surfaces here.
    // Retry once without stream_options.
    const msg = err instanceof Error ? err.message : String(err);
    if (/stream_options|include_usage|unknown parameter/i.test(msg)) {
      console.warn("[generation] stream_options rejected, retrying without");
      stream = ai.chat.completions.stream(baseParams);
      stream.on("content", (delta: string) => {
        if (!firstTokenMs && delta.length > 0) {
          firstTokenMs = performance.now() - codingStartedAt;
        }
      });
      rawText = (await stream.finalContent()) ?? "";
    } else {
      throw err;
    }
  }

  const files = extractAllCodeBlocks(rawText).map((file) => ({
    path: file.path,
    content: file.code,
  }));

  return { files, rawText, firstTokenMs };
}
