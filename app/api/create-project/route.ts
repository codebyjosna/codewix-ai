import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { createProjectSchema, firstIssueMessage } from "@/lib/validation";
import { createChatRecord, createRandomId } from "@/lib/create-chat";
import { chooseModelForProject } from "@/lib/model-selection";
import { generateProjectId } from "@/lib/project-id";
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
      { error: "Sign in required to create a project" },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { name, description, buildPrompt, projectTypeId, visibilityId, screenshotUrl } =
    parsed.data;

  const prisma = getPrisma();

  // Never trust frontend ids: re-confirm both dropdown selections are real,
  // active, database-managed rows before writing anything.
  const [projectType, visibility] = await Promise.all([
    prisma.projectType.findFirst({
      where: { id: projectTypeId, isActive: true },
    }),
    prisma.projectVisibility.findFirst({
      where: { id: visibilityId, isActive: true },
    }),
  ]);
  if (!projectType) {
    return NextResponse.json(
      { error: "Invalid project type" },
      { status: 400 },
    );
  }
  if (!visibility) {
    return NextResponse.json(
      { error: "Invalid visibility option" },
      { status: 400 },
    );
  }

  const model = chooseModelForProject(projectType.slug, buildPrompt);
  const chatId = createRandomId();

  const logger = getBraintrustLogger();
  let traceStarted = false;

  try {
    const run = async (rootSpan?: Span) => {
      const { lastMessageId } = await createChatRecord({
        chatId,
        prompt: buildPrompt,
        model,
        screenshotUrl,
        rootSpan,
        route: "/api/create-project",
      });

      const projectId = await generateProjectId();
      await prisma.project.create({
        data: {
          id: projectId,
          userId,
          name,
          description,
          projectTypeId: projectType.id,
          visibilityId: visibility.id,
          chatId,
        },
      });

      rootSpan?.log({
        output: { chatId, lastMessageId, projectId },
        metadata: { completed: true },
      });

      return NextResponse.json({ projectId, chatId, lastMessageId, model });
    };

    if (!logger) return await run();

    traceStarted = true;
    const response = await logger.traced((span) => run(span), {
      name: "llamacoder.create-project",
      type: "task",
      event: {
        input: {
          name,
          description,
          buildPrompt,
          projectType: projectType.slug,
          visibility: visibility.slug,
          hasScreenshot: Boolean(screenshotUrl),
        },
        metadata: { chatId, model, route: "/api/create-project" },
      },
    });
    await flushBraintrust();
    return response;
  } catch (error) {
    console.error("Error creating project:", error);
    if (!traceStarted) {
      await logBraintrustFailure(
        {
          name: "llamacoder.create-project",
          type: "task",
          event: {
            metadata: {
              route: "/api/create-project",
              phase: "request-validation",
            },
          },
        },
        error,
      );
    }
    await flushBraintrust();
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 },
    );
  }
}
