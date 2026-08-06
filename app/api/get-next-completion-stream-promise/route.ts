import { z } from "zod";
import {
  getAIClientForModel,
  getProviderModelId,
  getProviderName,
  buildProviderErrorMessage,
  buildAllProvidersFailedMessage,
  getAllFallbackModels,
  AIProviderError,
  PROVIDERS,
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

      // M6: tie the upstream LLM stream to the client request signal so that
      // when the client disconnects (navigate away, tab close), the provider
      // stream is aborted and we stop being billed for further tokens.
      const abortController = new AbortController();
      if (req.signal) {
        if (req.signal.aborted) abortController.abort();
        else req.signal.addEventListener("abort", () => abortController.abort(), { once: true });
      }

      let stream: ReturnType<typeof ai.chat.completions.stream>;
      try {
        stream = ai.chat.completions.stream({
          model: resolvedModel,
          messages: inputMessages,
          temperature,
          max_tokens: maxTokens,
          stream_options: { include_usage: true },
          signal: abortController.signal,
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
        continue; // Try next provider
      }

      stream.on("content", (delta) => {
        if (!firstTokenMs && delta.length > 0) {
          firstTokenMs = performance.now() - startedAt;
          span?.log({ metrics: { first_token_ms: firstTokenMs } });
        }
      });

      stream
        .finalContent()
        .then(async (finalText) => {
          const usage = await stream.totalUsage().catch(() => undefined);
          const completion = await stream.finalChatCompletion().catch(() => undefined);
          const finishReason = completion?.choices?.[0]?.finish_reason ?? null;
          span?.log({
            output: finalText,
            metadata: {
              completed: finishReason !== "length",
              finish_reason: finishReason,
              truncated: finishReason === "length",
              outputChars: finalText?.length ?? 0,
            },
            metrics: {
              first_token_ms: firstTokenMs,
              total_generation_ms: performance.now() - startedAt,
              prompt_tokens: usage?.prompt_tokens ?? 0,
              completion_tokens: usage?.completion_tokens ?? 0,
              tokens: usage?.total_tokens ?? 0,
            },
          });
          span?.end();
          await flushBraintrustSpan(span);
        })
        .catch(async (error) => {
          span?.log({
            error: serializeBraintrustError(error),
            metrics: {
              first_token_ms: firstTokenMs,
              total_generation_ms: performance.now() - startedAt,
            },
          });
          span?.end();
          await flushBraintrustSpan(span);
        });

      return new Response(stream.toReadableStream());
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
