import "server-only";
import { getPrisma } from "@/lib/prisma";
import { screenshotToCodePrompt } from "@/lib/prompts";
import { buildProductionCodingPrompt } from "@/lib/prompt-config";
import { getNvidiaClient } from "@/lib/nvidia";
import { resolveModel } from "@/lib/constants";
import { createLocalChatTitle } from "@/lib/chat-title";
import { serializeBraintrustError } from "@/lib/braintrust";
import type { Span } from "braintrust";

export function createRandomId(size = 16) {
  const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-";
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => alphabet[byte & 63]).join("");
}

async function describeScreenshot(screenshotUrl: string, span?: Span) {
  const startedAt = performance.now();
  const screenshotModel = "meta/llama-3.2-11b-vision-instruct";
  const nvidia = getNvidiaClient();
  const screenshotResponse = await nvidia.chat.completions.create({
    model: screenshotModel,
    temperature: 0.4,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: screenshotToCodePrompt },
          { type: "image_url", image_url: { url: screenshotUrl } },
        ],
      },
    ],
  });

  const description = screenshotResponse.choices[0].message?.content ?? undefined;
  const usage = screenshotResponse.usage ?? undefined;
  span?.log({
    output: description,
    metadata: { model: screenshotModel, provider: "nvidia" },
    metrics: {
      duration_ms: performance.now() - startedAt,
      prompt_tokens: usage?.prompt_tokens ?? 0,
      completion_tokens: usage?.completion_tokens ?? 0,
      tokens: usage?.total_tokens ?? 0,
    },
  });
  return description;
}

// Shared by /api/create-chat and /api/create-project so both entry points
// use the exact same screenshot-description + chat/message creation logic.
export async function createChatRecord({
  chatId,
  prompt,
  model,
  screenshotUrl,
  rootSpan,
  route,
}: {
  chatId: string;
  prompt: string;
  model: string;
  screenshotUrl?: string;
  rootSpan?: Span;
  route: string;
}): Promise<{ chatId: string; lastMessageId: string }> {
  const resolvedModel = resolveModel(model);
  let fullScreenshotDescription: string | undefined;

  if (screenshotUrl) {
    try {
      fullScreenshotDescription = rootSpan
        ? await rootSpan.traced(
            (span) => describeScreenshot(screenshotUrl, span),
            {
              name: "llamacoder.describe-screenshot",
              type: "llm",
              event: {
                input: { prompt, hasScreenshot: true },
                metadata: { chatId, route, provider: "nvidia" },
              },
            },
          )
        : await describeScreenshot(screenshotUrl);
    } catch (err) {
      rootSpan?.log({
        error: serializeBraintrustError(err),
        metadata: { chatId, screenshotProcessingFailed: true },
      });
      console.warn(
        "Screenshot processing failed, continuing without it:",
        err,
      );
    }
  }

  const userMessage = fullScreenshotDescription
    ? prompt + "RECREATE THIS APP AS CLOSELY AS POSSIBLE: " + fullScreenshotDescription
    : prompt;

  const prisma = getPrisma();
  const lastMessageId = createRandomId();
  const braintrustParent = await rootSpan?.export();
  await prisma.chat.create({
    data: {
      id: chatId,
      model: resolvedModel,
      // The High-quality toggle was removed (benchmark: worse reliability, no
      // quality gain). All generations use the single minimal-v1 × inline path.
      quality: "low",
      prompt,
      title: createLocalChatTitle(prompt),
      braintrustParent,
      shadcn: true,
      messages: {
        create: [
          {
            id: createRandomId(),
            role: "system",
            content: buildProductionCodingPrompt(),
            position: 0,
          },
          {
            id: lastMessageId,
            role: "user",
            content: userMessage,
            position: 1,
          },
        ],
      },
    },
  });

  rootSpan?.log({
    output: { chatId, lastMessageId },
    metadata: { completed: true },
  });

  return { chatId, lastMessageId };
}
