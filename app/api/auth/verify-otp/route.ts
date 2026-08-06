import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { verifyOtp, createSession, createResetToken } from "@/lib/auth";
import { verifyOtpSchema, firstIssueMessage } from "@/lib/validation";

const RESET_TOKEN_COOKIE = "reset-token";
const RESET_TOKEN_MAX_AGE = 60 * 10; // 10 minutes

export async function POST(req: NextRequest) {
  const parsed = verifyOtpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { email, code, purpose } = parsed.data;

  const result = await verifyOtp(email, purpose, code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  if (purpose === "signup") {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });
    await createSession(user.id);
    return NextResponse.json({ redirect: `/${user.id}` });
  }

  const resetToken = await createResetToken(email);
  // L12: set the reset token as an httpOnly cookie so it doesn't leak via
  // Referer / browser history / proxy logs the way a URL query param does.
  // Still return it in the body for backward compat with older clients.
  const cookieStore = await cookies();
  cookieStore.set(RESET_TOKEN_COOKIE, resetToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: RESET_TOKEN_MAX_AGE,
  });
  return NextResponse.json({ resetToken });
}
