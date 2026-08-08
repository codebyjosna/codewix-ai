import { z } from "zod";
import OpenAI from "openai";
import {
  getAIClientForModel,
  getProviderModelId,
  getProviderName,
  buildProviderErrorMessage,
  buildAllProvidersFailedMessage,
  getAllFallbackModels,
  resolveModelSlug,
} from "@/lib/ai-provider";
import { getPrisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import {
  flushBraintrustSpan,
  logBraintrustFailure,
  serializeBraintrustError,
  startBraintrustSpan,
} from "@/lib/braintrust";

function optimizeMessagesForTokens(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): { role: "system" | "user" | "assistant"; content: string }[] {
  const assistantIndices: number[] = [];
  for (
    let i = messages.length - 1;
    i >= 0 && assistantIndices.length < 2;
    i--
  ) {
      if (messages[i].role === "assistant") {
        assistantIndices.push(i);
      }
    }
  return messages.map((msg, index) => {
    if (msg.role === "assistant" && !assistantIndices.includes(index)) {
      const stripped = msg.content.replace(/```[\s\S]*?```/g, "").trim();
      return {
        ...msg,
        content: stripped || "[code omitted]",
      };
    }
    return msg;
  });
}

const requestSchema = z.object({
  messageId: z.string().min(1),
  model: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    return await handleStreamRequest(req);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/**
 * Try to create a stream for the given model slug.
 * Returns the client, resolved model ID, and provider name on success.
 */
function tryCreateStream(
  model: string,
): { ai: ReturnType<typeof getAIClientForModel>; resolvedModel: string; providerName: string } {
  const ai = getAIClientForModel(model);
  const resolvedModel = getProviderModelId(model);
  const providerName = getProviderName(model);
  return { ai, resolvedModel, providerName };
}

async function handleStreamRequest(req: Request) {
  const prisma = getPrisma();

  // Auth: require a signed-in user.
  const userId = await getSessionUserId();
  if (!userId) {
    return new Response(JSON.stringify({ error: "Sign in required" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    await logBraintrustFailure(
      {
        name: "llamacoder.stream-generation",
        type: "llm",
        event: {
          metadata: {
            route: "/api/get-next-completion-stream-promise",
            phase: "request-validation",
          },
        },
      },
      new Error("Invalid request"),
    );
    return new Response("Invalid request", { status: 400 });
  }
  const { messageId, model } = parsed.data;

  let message;
  try {
    message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        chat: {
          select: {
            braintrustParent: true,
          },
        },
      },
    });
  } catch (error) {
    await logBraintrustFailure(
      {
        name: "llamacoder.stream-generation",
        type: "llm",
        event: {
          input: { messageId },
          metadata: {
            route: "/api/get-next-completion-stream-promise",
            phase: "message-lookup",
          },
        },
      },
      error,
    );
    throw error;
  }

  if (!message) {
    await logBraintrustFailure(
      {
        name: "llamacoder.stream-generation",
        type: "llm",
        event: {
          input: { messageId },
          metadata: {
            route: "/api/get-next-completion-stream-promise",
            phase: "message-lookup",
          },
        },
      },
      new Error("Message not found"),
    );
    return new Response(null, { status: 404 });
  }

  // Ownership: verify the caller owns the chat this message belongs to.
  // Prefer Chat.userId (direct); fall back to Project.chatId -> userId for
  // legacy chats that haven't been backfilled yet.
  const chat = await prisma.chat.findUnique({
    where: { id: message.chatId },
    select: { userId: true },
  });
  const ownsViaChat = chat?.userId === userId;
  const ownsViaProject =
    !ownsViaChat &&
    (await prisma.project.findFirst({
      where: { chatId: message.chatId, userId },
      select: { id: true },
    }));
  if (!ownsViaChat && !ownsViaProject) {
    return new Response(null, { status: 404 });
  }

  let messages;
  try {
    const messagesRes = await prisma.message.findMany({
      where: { chatId: message.chatId, position: { lte: message.position } },
      orderBy: { position: "asc" },
    });

    messages = z
      .array(
        z.object({
          role: z.enum(["system", "user", "assistant"]),
          content: z.string(),
        }),
      )
      .parse(messagesRes);
  } catch (error) {
    await logBraintrustFailure(
      {
        parent: message.chat.braintrustParent ?? undefined,
      name: "llamacoder.stream-generation",
      type: "llm",
      event: {
        input: { messageId },
        metadata: {
          route: "/api/get-next-completion-stream-promise",
          chatId: message.chatId,
          phase: "message-loading",
        },
      },
    },
      error,
    );
    throw error;
  }

  messages = optimizeMessagesForTokens(messages);

  if (messages.length > 10) {
    messages = [messages[0], messages[1], messages[2], ...messages.slice(-7)];
  }

  const temperature = 0.4;
  const maxTokens = 20000;
  const inputMessages = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const promptChars = inputMessages.reduce(
    (sum, item) => sum + item.content.length,
    0,
  );

  // ── Fallback chain ──────────────────────────────────────────────
  // Try the requested model first. On failure, try ALL remaining
  // providers in the fallback order (Groq -> Gemini -> Cerebras -> OpenRouter).
  // Each provider's default model is attempted exactly once.

  const fallbackEntries = getAllFallbackModels(model);
  const modelsToTry: string[] = [
    model,
    ...fallbackEntries.map((e) => e.slug),
  ];

  const allErrors: Array<{ provider: string; model: string; error: string }> = [];

  for (const modelSlug of modelsToTry) {
    const startedAt = performance.now();
    let firstTokenMs = 0;

    const entry = resolveModelSlug(modelSlug);
    const providerName = getProviderName(modelSlug);
    const resolvedModel = getProviderModelId(modelSlug);

    const span = startBraintrustSpan({
      parent: message.chat.braintrustParent ?? undefined,
      name: "llamacoder.stream-generation",
      type: "llm",
      event: {
        input: { messages: inputMessages },
        metadata: {
          route: "/api/get-next-completion-stream-promise",
          chatId: message.chatId,
          messageId,
          requestedModel: model,
          resolvedModel,
          model: resolvedModel,
          provider: providerName,
          messageCount: inputMessages.length,
          promptChars,
          temperature,
          maxTokens,
          isFallback: modelSlug !== model,
        },
      },
    });

    try {
      const { ai } = tryCreateStream(modelSlug);

      // ── Non-streaming approach for Amplify SSR compatibility ──────
      // AWS Amplify SSR (Lambda) doesn't properly support returning a
      // ReadableStream from an OpenAI SDK .stream() call — the Lambda
      // runtime can't pipe the SDK's internal event-emitter-based stream
      // to the HTTP response, resulting in a bare HTTP 500 with no body.
      //
      // Instead, we use the non-streaming create() call (which works
      // reliably on Amplify — the title-generation endpoint uses the same
      // pattern), then convert the complete response into SSE-formatted
      // chunks that the client's ChatCompletionStream.fromReadableStream()
      // can parse just like a real stream.
      const abortController = new AbortController();
      if (req.signal) {
        if (req.signal.aborted) abortController.abort();
        else req.signal.addEventListener("abort", () => abortController.abort(), { once: true });
      }

      let completion: OpenAI.Chat.Completions.ChatCompletion;
      try {
        completion = await ai.chat.completions.create({
          model: resolvedModel,
          messages: inputMessages,
          temperature,
          max_tokens: maxTokens,
        }, { signal: abortController.signal });
      } catch (error) {
        const errorMsg = buildProviderErrorMessage(entry.provider, modelSlug, error);
        allErrors.push({
          provider: entry.provider,
          model: modelSlug,
          error: errorMsg,
        });
        span?.log({
          error: serializeBraintrustError(error),
          metadata: {
            first_token_ms: firstTokenMs,
            total_generation_ms: performance.now() - startedAt,
            failedOnProvider: entry.provider,
          },
        });
        span?.end();
        await flushBraintrustSpan(span);
        console.warn(`[fallback] ${modelSlug} failed, trying next provider:`, errorMsg);
        continue; // Try next provider
      }

      const fullText = completion.choices[0]?.message?.content ?? "";
      const finishReason = completion.choices[0]?.finish_reason ?? "stop";
      firstTokenMs = performance.now() - startedAt;

      // Log to Braintrust
      span?.log({
        output: fullText,
        metadata: {
          completed: finishReason !== "length",
          finish_reason: finishReason,
          truncated: finishReason === "length",
          outputChars: fullText.length,
        },
        metrics: {
          first_token_ms: firstTokenMs,
          total_generation_ms: performance.now() - startedAt,
          prompt_tokens: completion.usage?.prompt_tokens ?? 0,
          completion_tokens: completion.usage?.completion_tokens ?? 0,
          tokens: completion.usage?.total_tokens ?? 0,
        },
      });
      span?.end();
      await flushBraintrustSpan(span);

      // Build a ReadableStream that emits the response as OpenAI-compatible
      // SSE chunks.  The client uses ChatCompletionStream.fromReadableStream()
      // which parses `data: {json}\n\n` lines — this is the exact format
      // the OpenAI API uses for streaming, so the client sees no difference.
      const completionId = completion.id || `chatcmpl-${Date.now()}`;
      const model_name = completion.model || resolvedModel;

      const encoder = new TextEncoder();
      const readable = new ReadableStream<Uint8Array>({
        start(controller) {
          // Split the full text into word-level chunks so the client's
          // progressive rendering (code highlighting, preview debouncing)
          // still works naturally.
          const tokens = fullText.match(/\S+\s*/g) || [fullText];
          for (const token of tokens) {
            const chunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: model_name,
              choices: [{ index: 0, delta: { content: token }, finish_reason: null }],
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
          // Final chunk with finish_reason
          const finalChunk = {
            id: completionId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: model_name,
            choices: [{ index: 0, delta: {}, finish_reason: finishReason }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
          // Usage chunk (if available) — stream_options.include_usage equivalent
          if (completion.usage) {
            const usageChunk = {
              id: completionId,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: model_name,
              choices: [],
              usage: completion.usage,
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(usageChunk)}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      return new Response(readable, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (error) {
      const errorMsg = buildProviderErrorMessage(entry.provider, modelSlug, error);
      allErrors.push({
        provider: entry.provider,
        model: modelSlug,
        error: errorMsg,
      });
      span?.log({
        error: serializeBraintrustError(error),
        metadata: {
          first_token_ms: firstTokenMs,
          total_generation_ms: performance.now() - startedAt,
          failedOnProvider: entry.provider,
        },
      });
      span?.end();
      await flushBraintrustSpan(span);
      console.warn(`[fallback] ${modelSlug} failed, trying next provider:`, errorMsg);
    }
  }

  // All providers failed — build a comprehensive error message
  const finalError = buildAllProvidersFailedMessage(allErrors);
  console.error("[fallback] All providers exhausted:", finalError);

  return new Response(JSON.stringify({ error: finalError }), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

export const maxDuration = 300;
