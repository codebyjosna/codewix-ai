import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPrisma } from "@/lib/prisma";
import { verifyResetToken, hashPassword, invalidateUserSessions } from "@/lib/auth";
import { resetPasswordConfirmSchema, firstIssueMessage } from "@/lib/validation";

const RESET_TOKEN_COOKIE = "reset-token";

export async function POST(req: NextRequest) {
  const parsed = resetPasswordConfirmSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }
  let { resetToken, password } = parsed.data;

  // L12: fall back to the httpOnly cookie if the body didn't include the token
  // (newer clients send it via cookie, not URL/body).
  if (!resetToken) {
    const cookieStore = await cookies();
    resetToken = cookieStore.get(RESET_TOKEN_COOKIE)?.value ?? "";
  }

  const email = await verifyResetToken(resetToken);
  if (!email) {
    return NextResponse.json(
      { error: "Reset link expired, please try again" },
      { status: 400 },
    );
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  // Bump tokenVersion: invalidates all existing sessions (H3) AND makes the
  // reset token single-use since it embeds the old version (H2).
  await invalidateUserSessions(user.id);

  // Clear the reset cookie now that it's been used.
  const cookieStore = await cookies();
  cookieStore.delete(RESET_TOKEN_COOKIE);

  return NextResponse.json({ ok: true });
}
