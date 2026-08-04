"use client";

import ArrowRightIcon from "@/components/icons/arrow-right";
import Spinner from "@/components/spinner";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createMessage } from "../../actions";
import { type Chat } from "./page";
import { MODELS } from "@/lib/constants";

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

export default function ChatBox({
  chat,
  onNewStreamPromise,
  isStreaming,
  onStopGeneration,
  streamElapsedMs,
}: {
  chat: Chat;
  onNewStreamPromise: (v: Promise<ReadableStream>) => void;
  isStreaming: boolean;
  onStopGeneration?: () => void;
  streamElapsedMs?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // While a generation is in-flight we still let the user type their next
  // prompt — we just hold the submit button disabled. This was the #1 UX
  // complaint: "ALWAYS WORKING MODE, CANNOT TYPE ANYTHING". The textarea
  // itself is never disabled; only the action button is.
  const submitDisabled = isPending || isStreaming;
  const didFocusOnce = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [prompt, setPrompt] = useState("");
  const textareaResizePrompt = prompt
    .split("\n")
    .map((text) => (text === "" ? "a" : text))
    .join("\n");

  const modelLabel =
    MODELS.find((m) => m.value === chat.model)?.label || chat.model;

  useEffect(() => {
    if (!textareaRef.current) return;

    if (!submitDisabled && !didFocusOnce.current) {
      textareaRef.current.focus();
      didFocusOnce.current = true;
    } else {
      didFocusOnce.current = false;
    }
  }, [submitDisabled]);

  function handleSubmit() {
    if (submitDisabled) return;
    if (prompt.trim().length === 0) return;

    startTransition(async () => {
      const message = await createMessage(chat.id, prompt, "user");
      const streamPromise = fetch(
        "/api/get-next-completion-stream-promise",
        {
          method: "POST",
          body: JSON.stringify({
            messageId: message.id,
            model: chat.model,
          }),
        },
      ).then((res) => {
        if (!res.body) {
          throw new Error("No body on response");
        }
        return res.body;
      });

      onNewStreamPromise(streamPromise);
      startTransition(() => {
        router.refresh();
        setPrompt("");
      });
    });
  }

  return (
    <div className="mx-auto mb-5 flex w-full max-w-prose shrink-0 flex-col gap-2 px-4">
      {isStreaming && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
            </span>
            <span className="font-medium">Generating…</span>
            {typeof streamElapsedMs === "number" && streamElapsedMs > 0 && (
              <span className="text-blue-500">
                {formatElapsed(streamElapsedMs)}
              </span>
            )}
          </div>
          {onStopGeneration && (
            <button
              type="button"
              onClick={onStopGeneration}
              className="rounded border border-blue-300 bg-white px-2 py-0.5 font-medium text-blue-700 transition hover:bg-blue-100"
            >
              Stop
            </button>
          )}
        </div>
      )}

      <form
        className="relative flex w-full"
        action={handleSubmit}
      >
        {/* The fieldset is never disabled — the textarea must remain
            editable while streaming so the user can draft the next
            message. Only the submit button is disabled. */}
        <fieldset className="w-full">
          <div className="relative flex flex-col rounded-lg border border-gray-300 bg-white">
            <div className="relative max-h-48 w-full overflow-hidden">
              <div className="w-full p-2.5">
                <p className="invisible max-h-48 min-h-[48px] w-full overflow-hidden whitespace-pre-wrap">
                  {textareaResizePrompt}
                </p>
              </div>
              <textarea
                ref={textareaRef}
                placeholder={
                  isStreaming
                    ? "Type your next message — it will send when this generation finishes…"
                    : "Ask a follow up..."
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                required
                name="prompt"
                className="peer absolute bottom-1 left-0 right-1 top-1 resize-none overflow-y-auto bg-transparent px-2.5 py-1.5 placeholder-gray-500 focus:outline-none"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (submitDisabled) return;
                    handleSubmit();
                  }
                }}
              />
            </div>

            <div className="flex w-full justify-between p-1.5 pl-2.5 has-[:disabled]:opacity-50">
              <div
                className="max-w-[200px] items-center truncate font-mono text-xs text-gray-500"
                title={chat.model}
              >
                {modelLabel}
              </div>

              <button
                className="relative inline-flex size-6 items-center justify-center rounded bg-blue-500 font-medium text-white shadow-lg outline-blue-300 hover:bg-blue-500/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={submitDisabled || prompt.trim().length === 0}
                title={
                  submitDisabled
                    ? "Wait for the current generation to finish"
                    : "Send message (Enter)"
                }
              >
                <Spinner loading={submitDisabled}>
                  <ArrowRightIcon />
                </Spinner>
              </button>
            </div>
          </div>
        </fieldset>
      </form>
    </div>
  );
}
