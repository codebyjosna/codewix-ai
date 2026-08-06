import "server-only";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Codewix <onboarding@resend.dev>";

export type SendOtpResult = { ok: true } | { ok: false; error: string };

export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: "signup" | "reset",
): Promise<SendOtpResult> {
  const subject =
    purpose === "signup"
      ? "Verify your Codewix account"
      : "Reset your Codewix password";
  const text = `Your Codewix verification code is ${code}. It expires in 10 minutes.`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No email provider configured: log so local/dev testing still works.
    // Treat as success in dev so the flow doesn't break locally.
    console.log(`[dev otp] ${purpose} code for ${email}: ${code}`);
    return { ok: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject,
        text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Failed to send OTP email:", detail);
      return {
        ok: false,
        error: `Email delivery failed (${res.status}). Please try again.`,
      };
    }
    return { ok: true };
  } catch (err) {
    console.error("sendOtpEmail: network error", err);
    return {
      ok: false,
      error: "Could not reach the email provider. Please try again.",
    };
  }
}
