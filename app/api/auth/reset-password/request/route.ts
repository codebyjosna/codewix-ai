import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { issueOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { resetPasswordRequestSchema, firstIssueMessage } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const parsed = resetPasswordRequestSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { email } = parsed.data;
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always respond the same way to avoid leaking whether the email exists.
  if (user) {
    const otp = await issueOtp(email, "reset");
    if (otp.ok) {
      await sendOtpEmail(email, otp.code, "reset");
    }
  }

  return NextResponse.json({ email });
}
