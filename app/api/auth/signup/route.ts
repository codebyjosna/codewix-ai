import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { hashPassword, issueOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { signUpSchema, firstIssueMessage } from "@/lib/validation";
import { checkRateLimit, getClientId } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // M5: IP-based rate limiting — 5 signups per IP per 5 minutes.
  const ip = getClientId(req);
  const rl = checkRateLimit({
    key: `signup:${ip}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

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
  // L11: don't 409 on already-registered verified accounts — that leaks that
  // the email is a registered, verified account. Instead, if the account is
  // already verified, skip the re-signup but still return a generic 200 so
  // the response is indistinguishable from a successful signup.
  if (existing?.emailVerified) {
    // Send a fresh OTP so the legitimate owner can still log in, but don't
    // overwrite their password (the caller may be an attacker).
    const otp = await issueOtp(email, "signup");
    if (otp.ok) {
      await sendOtpEmail(email, otp.code, "signup");
    }
    return NextResponse.json({ email });
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
  const sent = await sendOtpEmail(email, otp.code, "signup");
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 502 });
  }

  return NextResponse.json({ email });
}
