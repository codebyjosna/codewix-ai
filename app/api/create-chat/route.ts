import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";
import { resolveModel } from "@/lib/constants";
import { createChatRecord, createRandomId } from "@/lib/create-chat";
import {
  flushBraintrust,
  getBraintrustLogger,
  logBraintrustFailure,
} from "@/lib/braintrust";
import type { Span } from "braintrust";

export async function POST(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in required to create an app" },
      { status: 401 },
    );
  }

  const logger = getBraintrustLogger();
  let traceStarted = false;

  try {
    const body = await request.json();
    const { prompt, model, screenshotUrl } = body;
    const resolvedModel = resolveModel(model);
    const chatId = createRandomId();

    const run = async (rootSpan?: Span) => {
      const result = await createChatRecord({
        chatId,
        prompt,
        model,
        screenshotUrl,
        rootSpan,
        route: "/api/create-chat",
      });
      return NextResponse.json(result);
    };

    if (!logger) return await run();

    traceStarted = true;
    const response = await logger.traced((span) => run(span), {
      name: "llamacoder.create-chat",
      type: "task",
      event: {
        input: {
          prompt,
          requestedModel: model,
          hasScreenshot: Boolean(screenshotUrl),
        },
        metadata: {
          chatId,
          resolvedModel,
          route: "/api/create-chat",
        },
      },
    });
    await flushBraintrust();
    return response;
  } catch (error) {
    console.error("Error creating chat:", error);
    if (!traceStarted) {
      await logBraintrustFailure(
        {
          name: "llamacoder.create-chat",
          type: "task",
          event: {
            metadata: {
              route: "/api/create-chat",
              phase: "request-validation",
            },
          },
        },
        error,
      );
    }
    await flushBraintrust();
    return NextResponse.json(
      { error: "Failed to create chat" },
      { status: 500 },
    );
  }
}
