import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { verifyOtp, createSession, createResetToken } from "@/lib/auth";
import { verifyOtpSchema, firstIssueMessage } from "@/lib/validation";

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
    return NextResponse.json({ redirect: "/" });
  }

  const resetToken = await createResetToken(email);
  return NextResponse.json({ resetToken });
}
