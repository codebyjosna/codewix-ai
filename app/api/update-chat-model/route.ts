import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { MODELS } from "@/lib/constants";

// Allow the user to switch the model mid-chat. The next message they send
// will use the new model. We re-validate the model id against the MODELS
// list so a stale client can't write an arbitrary string to the DB.
export async function PATCH(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in required to change model" },
      { status: 401 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.chatId !== "string" || typeof body.model !== "string") {
    return NextResponse.json(
      { error: "chatId and model are required" },
      { status: 400 },
    );
  }

  const allowedModels = MODELS.map((m) => m.value);
  if (!allowedModels.includes(body.model)) {
    return NextResponse.json(
      { error: "Unknown model" },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  // Make sure the chat actually belongs to the signed-in user before
  // mutating it. We don't have a userId column on Chat directly in all
  // setups, but Project links userId -> chatId, so verify via that.
  const project = await prisma.project.findFirst({
    where: { chatId: body.chatId, userId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json(
      { error: "Chat not found" },
      { status: 404 },
    );
  }

  await prisma.chat.update({
    where: { id: body.chatId },
    data: { model: body.model },
  });

  return NextResponse.json({ ok: true, model: body.model });
}

export const maxDuration = 15;
