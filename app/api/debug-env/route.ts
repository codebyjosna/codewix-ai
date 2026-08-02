import { NextResponse } from "next/server";

// Temporary diagnostic endpoint — remove after root-causing the missing runtime env vars.
export async function GET() {
  const keys = Object.keys(process.env);
  return NextResponse.json({
    totalEnvVarCount: keys.length,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasAuthSecret: !!process.env.AUTH_SECRET,
    hasResendApiKey: !!process.env.RESEND_API_KEY,
    hasTogetherApiKey: !!process.env.TOGETHER_API_KEY,
    nodeEnv: process.env.NODE_ENV ?? null,
    sampleKeys: keys.filter((k) => !k.startsWith("npm_")).slice(0, 40),
  });
}
