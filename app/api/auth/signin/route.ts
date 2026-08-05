import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { verifyPassword, createSession, DUMMY_PASSWORD_HASH } from "@/lib/auth";
import { signInSchema, firstIssueMessage } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const parsed = signInSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { email, password } = parsed.data;
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { email } });
  const validPassword = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  if (!user || !validPassword) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  if (!user.emailVerified) {
    return NextResponse.json(
      {
        error: "Please verify your email first",
        email: user.email,
        needsVerification: true,
      },
      { status: 403 },
    );
  }

  await createSession(user.id);
  return NextResponse.json({ redirect: `/${user.id}` });
}
