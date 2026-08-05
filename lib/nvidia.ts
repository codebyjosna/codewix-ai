import OpenAI from "openai";

// Groq exposes an OpenAI-compatible Chat Completions API. See:
// https://console.groq.com/docs/api-reference#chat
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

export function getAIClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: GROQ_BASE_URL,
  });
}

// Backward-compatible alias so existing call-sites can migrate incrementally.
export const getNvidiaClient = getAIClient;
