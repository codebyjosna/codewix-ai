import { NextRequest, NextResponse } from "next/server";
import { getAIClientForModel, getProviderModelId, getProviderName } from "@/lib/ai-provider";
import { getPrisma } from "@/lib/prisma";
import {
  cleanGeneratedChatTitle,
  createLocalChatTitle,
} from "@/lib/chat-title";
import {
  flushBraintrust,
  getBraintrustLogger,
  logBraintrustFailure,
} from "@/lib/braintrust";
import type { Span } from "braintrust";

import { TITLE_MODEL } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const logger = getBraintrustLogger();

  try {
    const body = await request.json().catch(() => null);
    const chatId = body?.chatId;
    if (typeof chatId !== "string" || !chatId) {
      await logBraintrustFailure(
        {
          name: "llamacoder.generate-chat-title",
          type: "llm",
          event: {
            metadata: {
              route: "/api/generate-chat-title",
              phase: "request-validation",
            },
          },
        },
        new Error("Missing chatId"),
      );
      return NextResponse.json({ error: "Missing chatId" }, { status: 400 });
    }

    const prisma = getPrisma();
    let chat;
    try {
      chat = await prisma.chat.findUnique({
        where: { id: chatId },
        select: {
          id: true,
          prompt: true,
          title: true,
          braintrustParent: true,
        },
      });
    } catch (error) {
      await logBraintrustFailure(
        {
          name: "llamacoder.generate-chat-title",
          type: "llm",
          event: {
            input: { chatId },
            metadata: {
              route: "/api/generate-chat-title",
              phase: "chat-lookup",
            },
          },
        },
        error,
      );
      throw error;
    }

    if (!chat) {
      await logBraintrustFailure(
        {
          name: "llamacoder.generate-chat-title",
          type: "llm",
          event: {
            input: { chatId },
            metadata: {
              route: "/api/generate-chat-title",
              phase: "chat-lookup",
            },
          },
        },
        new Error("Chat not found"),
      );
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const generateTitle = async (span?: Span) => {
      const localTitle = createLocalChatTitle(chat.prompt);
      if (chat.title && chat.title !== localTitle) {
        span?.log({
          output: chat.title,
          metadata: {
            skipped: true,
            reason: "title-already-generated",
          },
        });
        return NextResponse.json({ title: chat.title, skipped: true });
      }

      const startedAt = performance.now();
      const ai = getAIClientForModel(TITLE_MODEL);
      const titleModelId = getProviderModelId(TITLE_MODEL);
      const titleProviderName = getProviderName(TITLE_MODEL);
      const response = await ai.chat.completions.create({
        model: titleModelId,
        temperature: 0.2,
        max_tokens: 24,
        messages: [
          {
            role: "system",
            content:
              "Create a succinct 3-5 word title for this app-building chat. Return only the title.",
          },
          {
            role: "user",
            content: chat.prompt,
          },
        ],
      });
      const usage = response.usage ?? undefined;

      const generatedTitle = cleanGeneratedChatTitle(
        response.choices[0].message?.content ?? "",
        localTitle,
      );

      await prisma.chat.update({
        where: { id: chat.id },
        data: { title: generatedTitle },
      });

      span?.log({
        output: generatedTitle,
        metadata: {
          model: TITLE_MODEL,
          provider: titleProviderName,
        },
        metrics: {
          duration_ms: performance.now() - startedAt,
          prompt_tokens: usage?.prompt_tokens ?? 0,
          completion_tokens: usage?.completion_tokens ?? 0,
          tokens: usage?.total_tokens ?? 0,
        },
      });

      return NextResponse.json({ title: generatedTitle });
    };

    if (!logger) return await generateTitle();

    const response = await logger.traced((span) => generateTitle(span), {
      parent: chat.braintrustParent ?? undefined,
      name: "llamacoder.generate-chat-title",
      type: "llm",
      event: {
        input: {
          prompt: chat.prompt,
        },
        metadata: {
          route: "/api/generate-chat-title",
          chatId: chat.id,
          model: TITLE_MODEL,
          provider: titleProviderName,
        },
      },
    });
    await flushBraintrust();
    return response;
  } catch (error) {
    console.error("Error generating chat title:", error);
    await flushBraintrust();
    return NextResponse.json(
      { error: "Failed to generate chat title" },
      { status: 500 },
    );
  }
}
