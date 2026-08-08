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
│   ├── model-selection.ts        # Deterministic model routing (codestral-latest default)
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

| Provider | Env Key | Base URL | Status |
|----------|---------|----------|--------|
| **Mistral AI** | `MISTRAL_API_KEY` | `https://api.mistral.ai/v1` | **ACTIVE** |
| Groq | `GROQ_API_KEY` | `https://api.groq.com/openai/v1` | MUTED |
| Google Gemini | `GEMINI_API_KEY` | `https://generativelanguage.googleapis.com/v1beta/openai/` | MUTED |
| Cerebras | `CEREBRAS_API_KEY` | `https://api.cerebras.ai/v1` | MUTED |
| OpenRouter | `OPENROUTER_API_KEY` | `https://openrouter.ai/api/v1` | MUTED |

**Mistral AI is the only active provider.** The four legacy providers are
kept in the registry so legacy DB rows still resolve, but they are removed
from `PROVIDER_FALLBACK_ORDER` and every model they back is marked
`hidden: true`. Legacy model slugs (e.g. `llama-3.3-70b`) are transparently
remapped to active Mistral equivalents via `LEGACY_SLUG_ALIASES` so
existing chats keep working without a DB migration.

All API keys are server-side only (`process.env`). The client only sends/receives model slug strings.

---

## Model Registry

### Active (Mistral AI)

| Slug | Label | Provider | Note |
|------|-------|----------|------|
| `codestral-latest` | Codestral | Mistral AI | ⚡ Fast & code-tuned (DEFAULT) |
| `mistral-large-latest` | Mistral Large | Mistral AI | 💎 Best quality |
| `mistral-small-latest` | Mistral Small | Mistral AI | 🚀 Quick & cheap |

**Default model:** `codestral-latest` (hardcoded, independent of API key availability).

### Legacy (muted, hidden from UI)

`llama-3.3-70b`, `qwen-3.6-27b`, `llama-3.1-8b`, `gpt-oss-120b`, `gpt-oss-20b`,
`gemini-2.5-flash`, `gemini-2.5-pro`, `cerebras-llama-4-scout`,
`cerebras-llama-4-maverick`, `openrouter-deepseek-v3`, `openrouter-qwen3-coder`.

These slugs still resolve (via `LEGACY_SLUG_ALIASES`) to active Mistral
equivalents so existing chats continue to work.

---

## Fallback Chain

```
Mistral AI (codestral-latest)   [single-provider — no fallback]
```

1. User's requested model is tried first.
2. On failure, ALL remaining ACTIVE providers are tried in order.
   Currently there is only one active provider, so the chain is a single hop.
3. If the request fails (or `MISTRAL_API_KEY` is missing), a clear error is returned.

Re-enabling a muted provider is a one-line change in `lib/ai-provider.ts`:
set `active: true` on its `PROVIDERS` entry and add its key to `PROVIDER_FALLBACK_ORDER`.

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
Generates chat title using `mistral-small-latest` (cheap, fast — ideal for the 24-token title call).

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
| `MISTRAL_API_KEY` | Yes (ACTIVE) | ai-provider.ts |
| `GROQ_API_KEY` | Optional (MUTED) | ai-provider.ts |
| `GEMINI_API_KEY` | Optional (MUTED) | ai-provider.ts |
| `CEREBRAS_API_KEY` | Optional (MUTED) | ai-provider.ts |
| `OPENROUTER_API_KEY` | Optional (MUTED) | ai-provider.ts |
| `RESEND_API_KEY` | Yes | Email OTP |
| `RESEND_FROM_EMAIL` | Yes | Email OTP |
| `BRAINTRUST_API_KEY` | Optional | braintrust.ts |
