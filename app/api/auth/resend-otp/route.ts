import { NextRequest, NextResponse } from "next/server";
import { issueOtp } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/email";
import { resendOtpSchema, firstIssueMessage } from "@/lib/validation";

export async function POST(req: NextRequest) {
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
  await sendOtpEmail(email, otp.code, purpose);
  return NextResponse.json({ ok: true });
}
