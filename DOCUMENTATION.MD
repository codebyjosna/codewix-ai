# Codewix — Technical Documentation

> **Last updated:** 2026-08-05
> **Version:** v2 (llamaCoderVersion)
> **Domain:** [codewix.in](https://codewix.in)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [AI Provider System](#ai-provider-system)
5. [Model Registry](#model-registry)
6. [Fallback Chain](#fallback-chain)
7. [API Routes](#api-routes)
8. [Database Schema](#database-schema)
9. [Deployment](#deployment)
10. [Environment Variables](#environment-variables)
11. [Key File Reference](#key-file-reference)
12. [Error Handling](#error-handling)

---

## Overview

**Codewix** is an AI-powered "idea to app" platform. Users describe an application in plain text (or upload a screenshot), and Codewix generates a fully working React/TypeScript/Tailwind CSS application with live in-browser preview.

### Core User Flow

1. User signs in (email OTP or GitHub OAuth)
2. User types a prompt or uploads a screenshot on the home page
3. User selects a project type (Website, Web App, Landing Page, etc.)
4. Codewix creates a project and chat record in the database
5. The prompt is sent to the selected AI model via streaming API
6. The AI response is streamed in real-time, parsed for code blocks
7. Code is rendered in a live preview panel using esbuild-wasm
8. User can iterate with follow-up messages, switch models, or fix errors

---

## Architecture

```
codewix.in
├── app/
│   ├── (main)/                    # Main layout group
│   │   ├── layout.tsx             # Root layout with Providers + Toaster
│   │   ├── home-client.tsx        # Home page (hero, prompt input)
│   │   ├── chats/[id]/            # Chat page
│   │   │   ├── page.tsx           # Server component (loads chat from DB)
│   │   │   ├── page.client.tsx    # Client component (streaming, code viewer)
│   │   │   ├── chat-box.tsx       # Message input + model selector
│   │   │   ├── chat-log.tsx       # Message history display
│   │   │   ├── code-viewer.tsx    # Code/preview panel
│   │   │   └── error-dialog.tsx   # Categorized error display
│   │   └── user/[id]/             # User dashboard
│   └── api/
│       ├── get-next-completion-stream-promise/route.ts  # AI streaming + fallback chain
│       ├── create-project/route.ts                     # Project creation
│       ├── update-chat-model/route.ts                   # Model switching
│       └── auth/                                         # Authentication endpoints
├── lib/
│   ├── ai-provider.ts            # MULTI-PROVIDER AI REGISTRY (single source of truth)
│   ├── model-selection.ts        # Deterministic model routing (llama-3.3-70b default)
│   ├── constants.ts              # MODELS list for UI picker
│   ├── prisma.ts                 # Prisma client singleton
│   └── utils.ts                  # General utilities
├── components/
│   ├── ui/                       # shadcn/ui + base-ui components
│   ├── site-header.tsx           # Home page header
│   └── home/                     # Home page sections
└── prisma/schema.prisma          # Database schema (PostgreSQL, multi-schema)
```

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|----------|
| Framework | Next.js | 16.2.6 |
| Language | TypeScript | 5.9.3 |
| React | React | 19.2.7 |
| Styling | Tailwind CSS | 4.3.2 |
| UI Components | shadcn/ui + @base-ui/react | 0.2.0 / 1.6.0 |
| Database | PostgreSQL (Supabase) | — |
| ORM | Prisma | 6.5.0 |
| AI SDK | OpenAI Node.js SDK | 7.3.0 |
| In-browser Build | esbuild-wasm | 0.25.5 |
| Auth | Custom (jose JWT + bcryptjs) | — |
| File Upload | next-s3-upload | 0.3.4 |
| Observability | Braintrust | 3.21.0 |
| Email | Resend | — |
| Deployment | AWS Amplify | — |

---

## AI Provider System

### Provider Configuration

| Provider | Env Key | Base URL |
|----------|---------|----------|
| Groq | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` |
| Google Gemini | `GEMINI_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/openai/` |
| Cerebras | `CEREBRAS_API_KEY` | `https://api.cerebras.ai/v1` |
| OpenRouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` |

All API keys are server-side only (`process.env`). The client only sends/receives model slug strings.

---

## Model Registry

| Slug | Label | Provider | Note |
|------|-------|----------|------|
| `llama-3.3-70b` | Llama 3.3 70B | Groq | Fastest (DEFAULT) |
| `qwen-3.6-27b` | Qwen 3.6 27B | Groq | Quick & capable |
| `gemini-2.5-flash` | Gemini 2.5 Flash | Gemini | Smart & fast |
| `gemini-2.5-pro` | Gemini 2.5 Pro | Gemini | Best quality |
| `cerebras-llama-4-scout` | Llama 4 Scout | Cerebras | Ultra-fast |
| `cerebras-llama-4-maverick` | Llama 4 Maverick | Cerebras | Fast & capable |
| `openrouter-deepseek-v3` | DeepSeek V3 | OpenRouter | Strong reasoning |
| `openrouter-qwen3-coder` | Qwen 3 Coder | OpenRouter | Code specialist |

**Default model:** `llama-3.3-70b` (hardcoded, independent of API key availability).

---

## Fallback Chain

```
Groq (llama-3.3-70b) → Gemini (gemini-2.5-flash) → Cerebras (cerebras-llama-4-scout) → OpenRouter (openrouter-deepseek-v3)
```

1. User's requested model is tried first.
2. On failure, ALL remaining providers are tried in order.
3. Each provider is attempted exactly once.
4. If all fail, a comprehensive error listing all failures is returned.

### Error Categorization

| Type | Detection | Message |
|------|-----------|---------|
| Missing API key | `MISSING_API_KEY` code | "<PROVIDER> <MODEL> API key is missing or cannot fetch." |
| Rate limit / Quota | HTTP 429, "rate limit", "quota" | "<PROVIDER> <MODEL> is not responding because token quota reached." |
| Provider down | HTTP 500/502/503, "overloaded" | "<PROVIDER> <MODEL> is not responding. Provider sites may be down." |

---

## API Routes

### `POST /api/get-next-completion-stream-promise`
Main AI streaming endpoint with full 4-provider fallback chain. `maxDuration: 300`.

### `POST /api/create-project`
Creates project + chat record. Returns `{ projectId, chatId, lastMessageId, model }`.

### `PATCH /api/update-chat-model`
Switches model for a chat. Validates slug against registry.

### `POST /api/generate-chat-title`
Generates chat title using `llama-3.1-8b`.

---

## Database Schema

- **`public`** schema: User, OtpCode, Project, ProjectType, ProjectVisibility, ChatSession
- **`codewix_ai`** schema: Chat, Message, GeneratedApp

---

## Deployment

- **Platform:** AWS Amplify
- **Output:** `standalone`
- **Env vars:** Baked at build time via `next.config.ts` `env` block (Amplify doesn't inject runtime vars)
- **All AI keys must be set during build**

---

## Environment Variables

| Variable | Required | Used By |
|----------|----------|---------|
| `DATABASE_URL` | Yes | Prisma |
| `AUTH_SECRET` | Yes | jose JWT |
| `GROQ_API_KEY` | Yes | ai-provider.ts |
| `GEMINI_API_KEY` | Recommended | ai-provider.ts |
| `CEREBRAS_API_KEY` | Recommended | ai-provider.ts |
| `OPENROUTER_API_KEY` | Recommended | ai-provider.ts |
| `RESEND_API_KEY` | Yes | Email OTP |
| `RESEND_FROM_EMAIL` | Yes | Email OTP |
| `BRAINTRUST_API_KEY` | Optional | braintrust.ts |
