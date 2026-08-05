import "server-only";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Codewix <onboarding@resend.dev>";

export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: "signup" | "reset",
) {
  const subject =
    purpose === "signup"
      ? "Verify your Codewix account"
      : "Reset your Codewix password";
  const text = `Your Codewix verification code is ${code}. It expires in 10 minutes.`;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // No email provider configured: log so local/dev testing still works.
    console.log(`[dev otp] ${purpose} code for ${email}: ${code}`);
    return;
  }

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
    console.error("Failed to send OTP email:", await res.text());
  }
}
