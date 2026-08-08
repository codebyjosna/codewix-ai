import { z } from "zod";
import {
  getProviderConnectionForModel,
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
 * Get the raw connection details for a model slug (API key + base URL).
 * Used by the fetch()-based streaming proxy below.
 */
// (inline — getProviderConnectionForModel is imported from ai-provider)

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
    const resolvedModel = entry.modelId;

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
      const conn = getProviderConnectionForModel(modelSlug);

      if (!conn) {
        // No API key for this provider — skip to next in fallback chain
        const errorMsg = `${getProviderName(modelSlug)} API key is missing. Configure the environment variable.`;
        allErrors.push({ provider: entry.provider, model: modelSlug, error: errorMsg });
        span?.log({
          error: serializeBraintrustError(new Error(errorMsg)),
          metadata: { first_token_ms: firstTokenMs, total_generation_ms: performance.now() - startedAt, failedOnProvider: entry.provider },
        });
        span?.end();
        await flushBraintrustSpan(span);
        console.warn(`[fallback] ${modelSlug} skipped (no API key)`);
        continue;
      }

      // ── REAL streaming via fetch() + SSE proxy ────────────────────
      // AWS Amplify SSR (Lambda) can't pipe the OpenAI SDK's internal
      // event-emitter stream to the HTTP response.  Instead, we use raw
      // fetch() to POST to the provider's streaming endpoint, then pipe
      // the response body (a standard ReadableStream of SSE data) directly
      // to the client.  This gives TRUE token-by-token streaming — the
      // user sees code appearing in real time, like Google AI Studio.
      //
      // The provider's API (Mistral, Groq, etc.) returns OpenAI-compatible
      // SSE chunks, so no transformation is needed — the client's
      // ChatCompletionStream.fromReadableStream() parses them natively.
      const abortController = new AbortController();
      if (req.signal) {
        if (req.signal.aborted) abortController.abort();
        else req.signal.addEventListener("abort", () => abortController.abort(), { once: true });
      }

      let upstream: Response;
      try {
        upstream = await fetch(`${conn.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${conn.apiKey}`,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
          },
          body: JSON.stringify({
            model: conn.modelId,
            messages: inputMessages,
            temperature,
            max_tokens: maxTokens,
            stream: true,
            stream_options: { include_usage: true },
          }),
          signal: abortController.signal,
        });
      } catch (error) {
        const errorMsg = buildProviderErrorMessage(entry.provider, modelSlug, error);
        allErrors.push({ provider: entry.provider, model: modelSlug, error: errorMsg });
        span?.log({
          error: serializeBraintrustError(error),
          metadata: { first_token_ms: firstTokenMs, total_generation_ms: performance.now() - startedAt, failedOnProvider: entry.provider },
        });
        span?.end();
        await flushBraintrustSpan(span);
        console.warn(`[fallback] ${modelSlug} fetch failed, trying next provider:`, errorMsg);
        continue;
      }

      // If the provider returned a non-2xx status, read the error body
      // and try the next provider.
      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "");
        const errorMsg = buildProviderErrorMessage(entry.provider, modelSlug, new Error(`HTTP ${upstream.status}: ${errText.slice(0, 500)}`));
        allErrors.push({ provider: entry.provider, model: modelSlug, error: errorMsg });
        span?.log({
          error: serializeBraintrustError(new Error(errText)),
          metadata: { first_token_ms: firstTokenMs, total_generation_ms: performance.now() - startedAt, failedOnProvider: entry.provider, httpStatus: upstream.status },
        });
        span?.end();
        await flushBraintrustSpan(span);
        console.warn(`[fallback] ${modelSlug} HTTP ${upstream.status}, trying next provider`);
        continue;
      }

      // ── Pipe the upstream SSE stream through a TransformStream ────
      // The TransformStream intercepts chunks for Braintrust logging
      // (capturing content + usage as they pass through) without
      // buffering — each chunk is forwarded to the client immediately.
      let accumulatedContent = "";
      let capturedUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
      let capturedFinishReason: string | null = null;
      let sawFirstToken = false;

      const logStream = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          // Forward the chunk to the client IMMEDIATELY — no buffering.
          controller.enqueue(chunk);

          // Parse the SSE data for Braintrust logging (best-effort,
          // non-blocking — a parse failure doesn't affect the stream).
          try {
            const text = new TextDecoder().decode(chunk);
            for (const line of text.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6);
              if (payload === "[DONE]") continue;
              const ev = JSON.parse(payload);
              if (!sawFirstToken && ev.choices?.[0]?.delta?.content) {
                sawFirstToken = true;
                firstTokenMs = performance.now() - startedAt;
                span?.log({ metrics: { first_token_ms: firstTokenMs } });
              }
              if (ev.choices?.[0]?.delta?.content) {
                accumulatedContent += ev.choices[0].delta.content;
              }
              if (ev.choices?.[0]?.finish_reason) {
                capturedFinishReason = ev.choices[0].finish_reason;
              }
              if (ev.usage) {
                capturedUsage = ev.usage;
              }
            }
          } catch {
            // SSE parse error — don't interrupt the stream
          }
        },
        flush() {
          // Stream ended — log the final results to Braintrust.
          span?.log({
            output: accumulatedContent,
            metadata: {
              completed: capturedFinishReason !== "length",
              finish_reason: capturedFinishReason,
              truncated: capturedFinishReason === "length",
              outputChars: accumulatedContent.length,
            },
            metrics: {
              first_token_ms: firstTokenMs,
              total_generation_ms: performance.now() - startedAt,
              prompt_tokens: capturedUsage?.prompt_tokens ?? 0,
              completion_tokens: capturedUsage?.completion_tokens ?? 0,
              tokens: capturedUsage?.total_tokens ?? 0,
            },
          });
          span?.end();
          flushBraintrustSpan(span).catch(() => {});
        },
      });

      // Pipe: upstream.body → logStream → client
      const pipedStream = upstream.body.pipeThrough(logStream);

      return new Response(pipedStream, {
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
