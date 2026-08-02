import OpenAI from "openai";

// NVIDIA NIM exposes an OpenAI-compatible Chat Completions API. See:
// https://docs.api.nvidia.com/nim/reference/llm-apis
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export function getNvidiaClient(): OpenAI {
  return new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: NVIDIA_BASE_URL,
  });
}
