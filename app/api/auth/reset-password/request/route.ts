import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { issueOtp, verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { resetPasswordRequestSchema, firstIssueMessage } from "@/lib/validation";
import { checkRateLimit, getClientId } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // M5: IP-based rate limiting — 5 reset requests per IP per 5 minutes.
  const ip = getClientId(req);
  const rl = checkRateLimit({
    key: `reset-pw:${ip}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

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
  // L10: when user is null, run a dummy bcrypt.compare to match timing.
  if (user) {
    const otp = await issueOtp(email, "reset");
    if (otp.ok) {
      const sent = await sendOtpEmail(email, otp.code, "reset");
      if (!sent.ok) {
        // Don't leak the failure — still return a generic success to avoid
        // telling an attacker whether the email exists. Log internally.
        console.error("reset-password/request: email send failed for", email);
      }
    }
  } else {
    // Dummy work to equalize timing with the user-exists path.
    await verifyPassword("dummy", DUMMY_PASSWORD_HASH);
  }

  return NextResponse.json({ email });
}
