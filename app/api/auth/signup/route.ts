import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { hashPassword, issueOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { signUpSchema, firstIssueMessage } from "@/lib/validation";

export async function POST(req: NextRequest) {
  const parsed = signUpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { name, email, password } = parsed.data;
  const prisma = getPrisma();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing?.emailVerified) {
    return NextResponse.json(
      { error: "Email is already registered" },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { name, passwordHash },
    });
  } else {
    await prisma.user.create({ data: { name, email, passwordHash } });
  }

  const otp = await issueOtp(email, "signup");
  if (!otp.ok) {
    return NextResponse.json(
      {
        error: "Please wait before requesting another code",
        retryAfter: otp.retryAfter,
      },
      { status: 429 },
    );
  }
  await sendOtpEmail(email, otp.code, "signup");

  return NextResponse.json({ email });
}
