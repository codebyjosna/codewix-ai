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

  // Ownership: prefer Chat.userId (direct); fall back to Project.chatId -> userId.
  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: { userId: true },
  });
  if (!chat) notFound();

  const ownsViaChat = chat.userId === userId;
  const ownsViaProject =
    !ownsViaChat &&
    (await prisma.project.findFirst({
      where: { chatId, userId },
      select: { id: true },
    }));
  if (!ownsViaChat && !ownsViaProject) {
    throw new Error("Chat not found");
  }

  // Get the max position efficiently (don't fetch all messages).
  const maxResult = await prisma.message.aggregate({
    where: { chatId },
    _max: { position: true },
  });
  const maxPosition = maxResult._max.position ?? 0;

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
