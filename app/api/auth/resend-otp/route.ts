import { NextRequest, NextResponse } from "next/server";
import { issueOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { resendOtpSchema, firstIssueMessage } from "@/lib/validation";
import { checkRateLimit, getClientId } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  // M5: IP-based rate limiting — 5 OTP requests per IP per 5 minutes.
  const ip = getClientId(req);
  const rl = checkRateLimit({
    key: `resend-otp:${ip}`,
    limit: 5,
    windowMs: 5 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const parsed = resendOtpSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: firstIssueMessage(parsed.error) },
      { status: 400 },
    );
  }
  const { email, purpose } = parsed.data;

  const otp = await issueOtp(email, purpose);
  if (!otp.ok) {
    return NextResponse.json(
      {
        error: "Please wait before requesting another code",
        retryAfter: otp.retryAfter,
      },
      { status: 429 },
    );
  }
  const sent = await sendOtpEmail(email, otp.code, purpose);
  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
