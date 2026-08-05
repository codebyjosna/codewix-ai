"use server";

import { getPrisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";
import { notFound } from "next/navigation";

export async function createMessage(
  chatId: string,
  text: string,
  role: "assistant" | "user",
  files?: any[],
) {
  // Verify the caller is authenticated to prevent unauthenticated
  // message injection into arbitrary chats.
  const userId = await getSessionUserId();
  if (!userId) {
    throw new Error("Sign in required");
  }

  const prisma = getPrisma();
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    include: { messages: true },
  });
  if (!chat) notFound();

  // Verify the user owns this chat (via the project record) before
  // allowing message creation.  Prevents cross-user message injection.
  const owningProject = await prisma.project.findFirst({
    where: { chatId, userId },
    select: { id: true },
  });
  if (!owningProject) {
    // If no project links this chat to the user, deny access.
    // (All production chats are created via /api/create-project which
    // creates the project record.)
    throw new Error("Chat not found");
  }

  const maxPosition = Math.max(...chat.messages.map((m) => m.position));

  const newMessage = await prisma.message.create({
    data: {
      role,
      content: text,
      files: files ? JSON.parse(JSON.stringify(files)) : null,
      position: maxPosition + 1,
      chatId,
    },
  });

  return newMessage;
}