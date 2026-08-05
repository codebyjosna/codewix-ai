import { NextResponse } from "next/server";

// Temporary diagnostic endpoint - REMOVE after debugging
export async function GET() {
  const keys = {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
  };
  const status: Record<string, { present: boolean; prefix: string }> = {};
  for (const [key, val] of Object.entries(keys)) {
    status[key] = {
      present: !!val,
      prefix: val ? val.slice(0, 8) + "..." : "MISSING",
    };
  }
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    envStatus: status,
  });
}
