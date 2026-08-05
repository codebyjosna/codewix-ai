"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";

// Categorize an error message so the user can tell at a glance whether
// it's their network, the model provider, our app, or the model itself.
// The category drives the icon, color, and the "what to try" hint.
type ErrorCategory = "network" | "api" | "model" | "app" | "timeout" | "unknown";

function categorizeError(message: string): ErrorCategory {
  const m = message.toLowerCase();
  if (
    m.includes("timeout") ||
    m.includes("timed out") ||
    m.includes("did not respond") ||
    m.includes("no output for")
  ) {
    return "timeout";
  }
  if (
    m.includes("failed to fetch") ||
    m.includes("network") ||
    m.includes("connection") ||
    m.includes("dropped") ||
    m.includes("internet")
  ) {
    return "network";
  }
  if (
    m.includes("401") ||
    m.includes("403") ||
    m.includes("api key") ||
    m.includes("unauthorized") ||
    m.includes("forbidden") ||
    m.includes("rate limit") ||
    m.includes("429") ||
    m.includes("500") ||
    m.includes("502") ||
    m.includes("503") ||
    m.includes("server error") ||
    m.includes("nvidia") ||
    m.includes("provider")
  ) {
    return "api";
  }
  if (
    m.includes("model") &&
    (m.includes("not respond") ||
      m.includes("empty") ||
      m.includes("invalid") ||
      m.includes("refused"))
  ) {
    return "model";
  }
  if (
    m.includes("failed to save") ||
    m.includes("database") ||
    m.includes("prisma") ||
    m.includes("create message") ||
    m.includes("app structure")
  ) {
    return "app";
  }
  return "unknown";
}

const CATEGORY_META: Record<
  ErrorCategory,
  {
    label: string;
    icon: string;
    color: string;
    bgColor: string;
    borderColor: string;
    hint: string;
  }
> = {
  network: {
    label: "Network Error",
    icon: "📡",
    color: "#92400e",
    bgColor: "#fef3c7",
    borderColor: "#fcd34d",
    hint: "Your internet connection may have dropped, or the server is unreachable. Check your connection and try again.",
  },
  api: {
    label: "API / Provider Error",
    icon: "🔑",
    color: "#991b1b",
    bgColor: "#fee2e2",
    borderColor: "#fca5a5",
    hint: "The AI provider (NVIDIA NIM) rejected the request — this could be an invalid API key, rate limit, or server-side issue. Try again in a moment, or contact support if it persists.",
  },
  model: {
    label: "Model Not Responding",
    icon: "🤖",
    color: "#1e40af",
    bgColor: "#dbeafe",
    borderColor: "#93c5fd",
    hint: "The model accepted the request but produced no usable output. This is usually transient — try sending the prompt again, or simplify it.",
  },
  timeout: {
    label: "Generation Timed Out",
    icon: "⏱️",
    color: "#9a3412",
    bgColor: "#ffedd5",
    borderColor: "#fdba74",
    hint: "The model stopped responding before finishing. Complex prompts can take 60+ seconds; if it happens often, try breaking your request into smaller steps.",
  },
  app: {
    label: "Application Error",
    icon: "⚙️",
    color: "#581c87",
    bgColor: "#f3e8ff",
    borderColor: "#c084fc",
    hint: "Something went wrong on our side while saving or processing the response. Please try again — if the problem persists, the team has been notified.",
  },
  unknown: {
    label: "Unexpected Error",
    icon: "⚠️",
    color: "#374151",
    bgColor: "#f3f4f6",
    borderColor: "#d1d5db",
    hint: "An unexpected error occurred. Please try again, or retry with a simpler prompt.",
  },
};

export default function ErrorDialog({
  error,
  onClose,
}: {
  error: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  // Reset the "copied" state every time a new error appears so the user
  // can copy again on a fresh error.
  useEffect(() => {
    if (error) setCopied(false);
  }, [error]);

  if (!error) return null;

  const category = categorizeError(error);
  const meta = CATEGORY_META[category];

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(error ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked; ignore silently.
    }
  }

  return (
    <Dialog
      open={!!error}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-xl">
        <div
          className="flex items-start gap-3 rounded-lg border p-3"
          style={{
            backgroundColor: meta.bgColor,
            borderColor: meta.borderColor,
          }}
        >
          <span className="text-2xl leading-none">{meta.icon}</span>
          <div className="flex-1">
            <DialogTitle
              className="text-base font-semibold"
              style={{ color: meta.color }}
            >
              {meta.label}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-gray-700">
              {meta.hint}
            </DialogDescription>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-500">
            Error details
          </p>
          <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
            <pre className="whitespace-pre-wrap break-words font-mono text-xs text-gray-800">
              {error}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            {copied ? (
              <>
                <svg
                  className="size-4 text-green-600"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg
                  className="size-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                >
                  <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                  <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                </svg>
                Copy error
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
