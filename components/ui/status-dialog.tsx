"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

const AUTO_ADVANCE_SECONDS = 3;

type StatusDialogState = {
  variant: "success" | "error";
  message: string;
  /** Called automatically once the countdown reaches zero (success only). */
  onAutoAdvance?: () => void;
} | null;

export function useStatusDialog() {
  const [state, setState] = React.useState<StatusDialogState>(null);

  const showSuccess = React.useCallback(
    (message: string, onAutoAdvance?: () => void) => {
      setState({ variant: "success", message, onAutoAdvance });
    },
    [],
  );

  const showError = React.useCallback((message: string) => {
    setState({ variant: "error", message });
  }, []);

  const close = React.useCallback(() => setState(null), []);

  return { state, showSuccess, showError, close };
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-green-600" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-red-600" aria-hidden>
      <path
        d="M6 18L18 6M6 6l12 12"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StatusDialog({
  state,
  onClose,
}: {
  state: ReturnType<typeof useStatusDialog>["state"];
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = React.useState(AUTO_ADVANCE_SECONDS);
  const isSuccess = state?.variant === "success";

  React.useEffect(() => {
    if (!state || state.variant !== "success") return;

    setSecondsLeft(AUTO_ADVANCE_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    const timeout = setTimeout(() => {
      state.onAutoAdvance?.();
    }, AUTO_ADVANCE_SECONDS * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [state]);

  return (
    <DialogPrimitive.Root
      open={!!state}
      onOpenChange={(open) => {
        // Errors can be dismissed early; success runs to completion.
        if (!open && state?.variant === "error") onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/30 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 text-center shadow-xl ring-1 ring-black/5 transition-all data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 sm:p-7",
          )}
        >
          <div
            className={cn(
              "mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full",
              isSuccess ? "bg-green-100" : "bg-red-100",
            )}
          >
            {isSuccess ? <CheckIcon /> : <ErrorIcon />}
          </div>

          <DialogPrimitive.Title className="text-base font-medium text-gray-900">
            {state?.message}
          </DialogPrimitive.Title>

          {isSuccess ? (
            <DialogPrimitive.Description className="mt-2 text-sm text-gray-500">
              Redirecting in {secondsLeft}s...
            </DialogPrimitive.Description>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
            >
              Close
            </button>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
