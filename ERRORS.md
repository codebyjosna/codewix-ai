# Codewix – Complete Error Report

**Audit Date**: 2026-08-06
**Auditor**: Senior Full-Stack Zero-Assumption Audit
**Scope**: Every server-side file, API route, config, env vars, DB schema, Amplify config, client components

---

## PREVIOUSLY FOUND (Local fixes exist, NOT pushed to production)

### ERR-001: No fallback logic in streaming route [CRITICAL]
- **File**: `app/api/get-next-completion-stream-promise/route.ts`
- **Impact**: If the primary AI provider fails, the entire request dies with "All AI models failed"
- **Status**: ✅ FIXED — Being pushed in this commit (fallback loop in streaming route)

### ERR-002: Zero server-side logging [CRITICAL]
- **File**: `app/api/get-next-completion-stream-promise/route.ts`, `app/api/generate-chat-title/route.ts`
- **Impact**: Errors only went to Braintrust (invisible in CloudWatch). Zero `console.error()` calls made debugging impossible.
- **Status**: ✅ FIXED — Being pushed in this commit (console.error at every step)

### ERR-003: `getAIClientForModel()` throws on missing key [CRITICAL]
- **File**: `lib/ai-provider.ts`
- **Impact**: A single missing API key kills the entire request chain
- **Status**: ✅ FIXED — Being pushed in this commit (`tryGetAIClientForModel` + fallback chain)

---

## NEWLY FOUND IN THIS AUDIT

### ERR-004: `lib/domain.ts` uses Vercel-specific env vars – breaks on Amplify [HIGH]
- **File**: `lib/domain.ts`
- **Lines**: 1-10
- **Bug**: Checks `NEXT_PUBLIC_VERCEL_ENV`, `VERCEL_BRANCH_URL`, `NEXT_PUBLIC_VERCEL_URL`, `NEXT_PUBLIC_DEVELOPMENT_URL` – NONE exist on AWS Amplify. Always falls back to `http://localhost:3000`.
- **Impact**: OG image route (`/api/og/route.tsx`) generates images with `http://localhost:3000/dynamic-og.png` as background. Social media previews will show a broken image.
- **Fix**: Add `NEXT_PUBLIC_APP_URL` env var, check it first in the domain resolution chain.
- **Status**: ✅ FIXED — Added `NEXT_PUBLIC_APP_URL` as first check in `lib/domain.ts`. Added to `next.config.ts` env list. Set `NEXT_PUBLIC_APP_URL=https://www.codewix.in` in Amplify.

### ERR-005: Amplify console buildSpec overrides repo's `amplify.yml` [HIGH]
- **File**: `amplify.yml` (repo) vs Amplify console buildSpec
- **Bug**: The Amplify console has a different buildSpec that takes precedence:
  - Console: `pnpm install` (no `--frozen-lockfile`, no `corepack enable/prepare`)
  - Repo: `corepack enable` → `corepack prepare pnpm@9.15.9 --activate` → `pnpm install --frozen-lockfile`
- **Impact**: Builds may use wrong pnpm version or non-reproducible dependency resolution.
- **Fix**: Update the Amplify console buildSpec to match the repo's `amplify.yml`, or delete the console override so the repo file is used.
- **Status**: ✅ FIXED — Updated Amplify console buildSpec via AWS CLI to match repo's `amplify.yml` (with `corepack enable/prepare` + `--frozen-lockfile`).

### ERR-006: `BRAINTRUST_API_KEY` not set in Amplify env vars [MEDIUM]
- **File**: `next.config.ts` line 18, `lib/braintrust.ts`
- **Bug**: `BRAINTRUST_API_KEY` is listed in `next.config.ts` env baking but NOT set in Amplify environment variables. Same for `BRAINTRUST_PROJECT`.
- **Impact**: Braintrust observability is completely disabled. All spans/logs silently fail. Not a blocker, but you have zero visibility into LLM calls in production.
- **Fix**: Either add the key to Amplify env vars or remove from next.config.ts env list to avoid confusion.
- **Status**: ✅ FIXED — Removed `BRAINTRUST_API_KEY` and `BRAINTRUST_PROJECT` from `next.config.ts` env list (braintrust.ts handles missing keys gracefully).

### ERR-007: S3 upload env vars not configured [MEDIUM]
- **File**: `app/api/s3-upload/route.ts`, `app/(main)/home-client.tsx`, `app/(main)/chats/[id]/chat-box.tsx`
- **Bug**: `next-s3-upload` requires `S3_UPLOAD_BUCKET`, `S3_UPLOAD_REGION`, `S3_UPLOAD_ACCESS_KEY_ID`, `S3_UPLOAD_SECRET_ACCESS_KEY`. None are set in Amplify.
- **Impact**: Screenshot/image upload feature silently fails. Users can click Attach but uploads will error.
- **Fix**: Add S3 env vars to Amplify, or add error handling to show a user-friendly message when S3 is not configured.

### ERR-008: `lib/generation.ts` has no fallback logic [MEDIUM]
- **File**: `lib/generation.ts`
- **Lines**: 112, 125-126, 225-233
- **Bug**: Uses `getAIClientForModel()` (throws) instead of `tryGetAIClientForModel()`. No fallback loop. No `stream_options` retry.
- **Impact**: Only used in benchmark scripts, not production API routes. But if someone runs benchmarks, they'll get the same "all models failed" experience.
- **Fix**: Add fallback logic matching the streaming route pattern.
- **Status**: ✅ FIXED — Added full fallback loop for both planning and coding steps in `lib/generation.ts`. Uses `tryGetAIClientForModel` + `getFallbackModelSlugs`. Added `stream_options` retry.

### ERR-009: `getFallbackModelSlugs` same-provider check has logic flaw [MEDIUM]
- **File**: `lib/ai-provider.ts`
- **Line**: 273
- **Bug**: `if (seenProviders.has(entry.provider) && result.length > 1) continue;` – When `result.length === 1`, same-provider models are NOT skipped. If Groq key is invalid, trying a second Groq model will also fail.
- **Impact**: Wastes a fallback slot on a provider that's already proven to fail. User waits longer for the fallback chain to reach a working provider.
- **Fix**: Check if the LAST model in result has the same provider, not `result.length > 1`.
- **Status**: ✅ FIXED — Changed to `MODEL_REGISTRY[result[result.length - 1]]?.provider` comparison. Two same-provider models in a row are now always skipped.

### ERR-010: Screenshot description is hardcoded to skip [MEDIUM]
- **File**: `lib/create-chat.ts`
- **Lines**: 18-34
- **Bug**: `describeScreenshot()` always logs a warning and returns `undefined`. Comment says "Groq does not offer vision models" but Gemini (now a provider) DOES support vision.
- **Impact**: User-uploaded screenshots are completely ignored. The model never sees the actual image, only the text prompt.
- **Fix**: When the model is on Gemini, use its vision API to describe the screenshot.

### ERR-011: `app/api/update-chat-model/route.ts` fails for chats without a project [MEDIUM]
- **File**: `app/api/update-chat-model/route.ts`
- **Lines**: 37-46
- **Bug**: Verifies ownership via `project.chatId === body.chatId`. If a chat was created without a project (e.g., via `/api/create-chat` or old data), the PATCH returns 404.
- **Impact**: Users cannot switch models on older chats that lack a project record.
- **Fix**: Add a fallback ownership check or ensure all chats have an associated project.

### ERR-012: `app/(main)/actions.ts` `createMessage` has no auth check [HIGH]
- **File**: `app/(main)/actions.ts`
- **Lines**: 6-32
- **Bug**: The server action accepts any `chatId` and creates messages without verifying the caller owns the chat. No `getSessionUserId()` call.
- **Impact**: A malicious user could call this server action to inject messages into any chat if they know the chatId.
- **Fix**: Add `getSessionUserId()` check and verify chat ownership before creating the message.
- **Status**: ✅ FIXED — Added `getSessionUserId()` + project ownership verification to `app/(main)/actions.ts`.

### ERR-013: OpenRouter model ID may be stale [LOW]
- **File**: `lib/ai-provider.ts`
- **Line**: 139
- **Bug**: `deepseek/deepseek-chat-v3-0324:free` – The `:free` suffix models on OpenRouter are ephemeral. They can be rate-limited, removed, or renamed without notice.
- **Impact**: If this specific model ID is removed from OpenRouter, the fallback chain's last resort fails.
- **Fix**: Periodically verify the model is still available. Consider using a stable paid model as fallback instead.

### ERR-014: `qwen/qwen3.6-27b` may not be available on Groq [LOW]
- **File**: `lib/ai-provider.ts`
- **Line**: 84
- **Bug**: Groq's model catalog changes frequently. This model ID may have been renamed or removed.
- **Impact**: If a user selects "Qwen 3.6 27B" and it's no longer on Groq, it fails (then falls back correctly with the new code).
- **Fix**: Verify current Groq model catalog.

### ERR-015: Auth layout calls `getCurrentUser()` on every auth page [LOW]
- **File**: `app/(auth)/layout.tsx`
- **Line**: 10
- **Bug**: `getCurrentUser()` queries the database on every auth page load just to show the user's name in the header.
- **Impact**: Unnecessary DB round-trip on signin/signup pages where the user isn't signed in yet.
- **Fix**: This is acceptable for now – the query is fast and cached by React.

### ERR-016: `app/api/create-chat/route.ts` has unused variable [LOW]
- **File**: `app/api/create-chat/route.ts`
- **Line**: 27
- **Bug**: `const resolvedModel = resolveModel(model);` is computed but never used.
- **Impact**: Dead code, no functional impact.
- **Fix**: Remove the unused variable.
- **Status**: ✅ FIXED — Removed `resolvedModel` and the unused `resolveModel` import from `app/api/create-chat/route.ts`.

---

## ENVIRONMENT VERIFICATION

### Amplify Env Vars (verified via AWS CLI):
| Variable | Status | Value (truncated) |
|---|---|---|
| DATABASE_URL | ✅ Set | `postgresql://postgres.atkrx...@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres` |
| AUTH_SECRET | ✅ Set | `8U3JhvKj2...` |
| GROQ_API_KEY | ✅ Set | `gsk_J6Kj8wy...` |
| GEMINI_API_KEY | ✅ Set | `AQ.Ab8RN6...` (format looks unusual for Google – verify) |
| CEREBRAS_API_KEY | ✅ Set | `csk-hv68pm...` |
| OPENROUTER_API_KEY | ✅ Set | `sk-or-v1-c4606...` |
| RESEND_API_KEY | ✅ Set | `re_KUz1Vm...` |
| RESEND_FROM_EMAIL | ✅ Set | `Codewix <noreply@codewix.in>` |
| BRAINTRUST_API_KEY | ❌ NOT SET | Observability disabled |
| BRAINTRUST_PROJECT | ❌ NOT SET | Falls back to "llamacoder" |
| S3_UPLOAD_* | ❌ NOT SET | Upload feature broken |
| NEXT_PUBLIC_APP_URL | ✅ SET | `https://www.codewix.in` |

### next.config.ts env list vs Amplify env vars:
- All server-only env vars in `next.config.ts` are present in Amplify
- `BRAINTRUST_API_KEY`/`BRAINTRUST_PROJECT` removed from env list (not set in Amplify)
- `NEXT_PUBLIC_APP_URL` added to env list and set in Amplify
