import "server-only";
import { getPrisma } from "@/lib/prisma";
import { buildProductionCodingPrompt } from "@/lib/prompt-config";
import { resolveModelSlug } from "@/lib/ai-provider";
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

async function describeScreenshot(_screenshotUrl: string, span?: Span) {
  // NOTE: Vision models (e.g. Gemini) are now available but screenshot
  // description is not yet wired up. The user's text prompt is used as-is.
  // TODO: When ready, use a vision-capable provider to describe the screenshot.
  console.warn(
    "Screenshot processing skipped: vision description not yet implemented.",
  );
  span?.log({
    metadata: {
      screenshotSkipped: true,
      reason: "groq-no-vision",
    },
  });
  return undefined;
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
  // Store the model slug (not the provider-level ID) in the DB.
  // The slug is what the UI sends and what ai-provider resolves at call time.
  const modelSlug = resolveModelSlug(model).slug;
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
                metadata: { chatId, route, provider: "groq" },
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
    ? prompt + "\n\nRECREATE THIS APP AS CLOSELY AS POSSIBLE: " + fullScreenshotDescription
    : prompt;

  const prisma = getPrisma();
  const lastMessageId = createRandomId();
  const braintrustParent = await rootSpan?.export();
  await prisma.chat.create({
    data: {
      id: chatId,
      model: modelSlug,
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
