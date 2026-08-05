"use client";

import ArrowRightIcon from "@/components/icons/arrow-right";
import UploadIcon from "@/components/icons/upload-icon";
import Spinner from "@/components/spinner";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createMessage } from "../../actions";
import { type Chat } from "./page";
import { MODELS } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useS3Upload } from "next-s3-upload";
import { toast } from "@/hooks/use-toast";
import { X } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  // Attached images (URLs after S3 upload). Sent to the model as part of
  // the user message — the backend reads `chat.screenshotUrl` for the
  // initial prompt, but follow-up images get embedded as markdown image
  // links in the message content so they show up in the chat log too.
  const [attachedImages, setAttachedImages] = useState<
    Array<{ url: string; name: string }>
  >([]);
  const [imageUploading, setImageUploading] = useState(false);
  // Local model state — synced to the server via PATCH /api/update-chat-model
  // when the user picks a different one. Falls back to chat.model.
  const [selectedModel, setSelectedModel] = useState(chat.model);
  const [modelSwitching, setModelSwitching] = useState(false);

  const { uploadToS3 } = useS3Upload();

  const textareaResizePrompt = prompt
    .split("\n")
    .map((text) => (text === "" ? "a" : text))
    .join("\n");

  // Keep local selectedModel in sync if the chat.model changes server-side
  // (e.g. after router.refresh() following a model switch).
  useEffect(() => {
    setSelectedModel(chat.model);
  }, [chat.model]);

  useEffect(() => {
    if (!textareaRef.current) return;

    if (!submitDisabled && !didFocusOnce.current) {
      textareaRef.current.focus();
      didFocusOnce.current = true;
    } else {
      didFocusOnce.current = false;
    }
  }, [submitDisabled]);

  // Paste support: if the user pastes an image (screenshot) directly into
  // the textarea, upload it to S3 and attach it — same as clicking the
  // upload button. This is the "paste a screenshot" feature.
  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems = Array.from(items).filter(
      (item) => item.type.startsWith("image/"),
    );
    if (imageItems.length === 0) return;

    // Prevent the raw image bytes from being inserted as text/garbage.
    e.preventDefault();

    for (const item of imageItems) {
      const file = item.getAsFile();
      if (!file) continue;
      await uploadAndAttach(file);
    }
  }

  async function uploadAndAttach(file: File) {
    setImageUploading(true);
    try {
      const { url } = await uploadToS3(file);
      setAttachedImages((prev) => [
        ...prev,
        { url, name: file.name || "pasted-image" },
      ]);
      // If the user hasn't typed anything yet, seed the prompt so the
      // send button enables.
      if (prompt.trim().length === 0) setPrompt("Build this");
    } catch (err) {
      toast({
        title: "Upload failed",
        description:
          err instanceof Error ? err.message : "Could not upload image.",
        variant: "destructive",
      });
    } finally {
      setImageUploading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      void uploadAndAttach(file);
    });
    // Reset so the same file can be picked again after removal.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleModelChange(value: string) {
    if (value === selectedModel || value === null) return;
    setModelSwitching(true);
    setSelectedModel(value);
    try {
      const res = await fetch("/api/update-chat-model", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: chat.id, model: value }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      // Refresh server components so chat.model updates everywhere.
      router.refresh();
      toast({
        title: "Model switched",
        description: `Now using ${MODELS.find((m) => m.value === value)?.label ?? value} for new messages.`,
      });
    } catch (err) {
      // Revert on failure.
      setSelectedModel(chat.model);
      toast({
        title: "Could not switch model",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setModelSwitching(false);
    }
  }

  function handleSubmit() {
    if (submitDisabled) return;
    if (prompt.trim().length === 0 && attachedImages.length === 0) return;

    // Build the final message text. Images are embedded as markdown so
    // they render in the chat log AND the model can see them (the
    // backend already supports this for the initial screenshot URL).
    let finalText = prompt;
    if (attachedImages.length > 0) {
      const imageMarkdown = attachedImages
        .map((img) => `![${img.name}](${img.url})`)
        .join("\n");
      finalText = finalText.trim().length > 0
        ? `${finalText.trim()}\n\n${imageMarkdown}`
        : imageMarkdown;
    }

    startTransition(async () => {
      const message = await createMessage(chat.id, finalText, "user");
      const streamPromise = fetch("/api/get-next-completion-stream-promise", {
        method: "POST",
        body: JSON.stringify({
          messageId: message.id,
          model: selectedModel,
        }),
      }).then((res) => {
        if (!res.body) {
          throw new Error("No body on response");
        }
        return res.body;
      });

      onNewStreamPromise(streamPromise);
      startTransition(() => {
        router.refresh();
        setPrompt("");
        setAttachedImages([]);
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
        <fieldset className="w-full">
          <div className="relative flex flex-col rounded-lg border border-gray-300 bg-white">
            {/* Attached images preview row */}
            {(attachedImages.length > 0 || imageUploading) && (
              <div className="flex flex-wrap gap-2 p-2.5 pb-0">
                {attachedImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="group relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.url}
                      alt={img.name}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAttachedImages((prev) =>
                          prev.filter((_, i) => i !== idx),
                        )
                      }
                      className="absolute right-0 top-0 rounded-bl-lg bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      title="Remove image"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
                {imageUploading && (
                  <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
                    <Spinner className="size-4" />
                  </div>
                )}
              </div>
            )}

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
                onPaste={handlePaste}
                required={attachedImages.length === 0}
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

            <div className="flex w-full items-center justify-between p-1.5 pl-2.5">
              {/* Left: Upload button + Model selector */}
              <div className="flex items-center gap-2">
                <div>
                  <label
                    htmlFor="chat-screenshot"
                    className="flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                    title="Upload image (or paste a screenshot with Ctrl+V)"
                  >
                    <div className="flex size-6 items-center justify-center rounded bg-gray-900 hover:bg-gray-700">
                      <UploadIcon className="size-3.5" />
                    </div>
                    <span className="hidden sm:inline">Attach</span>
                  </label>
                  <input
                    id="chat-screenshot"
                    type="file"
                    accept="image/png, image/jpeg, image/webp, image/gif"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    ref={fileInputRef}
                    disabled={imageUploading}
                  />
                </div>

                <Select
                  value={selectedModel}
                  onValueChange={(value) => {
                    if (value !== null) handleModelChange(value);
                  }}
                  disabled={modelSwitching}
                >
                  <SelectTrigger
                    className="h-8 w-auto min-w-[120px] gap-1 border-gray-200 px-2 py-0 text-xs font-medium !outline-none !ring-0 !ring-transparent"
                    title="Switch model"
                  >
                    <SelectValue>
                      {modelSwitching
                        ? "Switching…"
                        : (MODELS.find((m) => m.value === selectedModel)?.label ||
                          selectedModel)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-w-[280px]">
                    {MODELS.filter((m) => !m.hidden).map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{m.label}</span>
                          {m.note && (
                            <span className="text-[10px] text-gray-500">
                              {m.note}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Right: Send button */}
              <button
                className="relative inline-flex size-6 items-center justify-center rounded bg-blue-500 font-medium text-white shadow-lg outline-blue-300 hover:bg-blue-500/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                type="submit"
                disabled={
                  submitDisabled ||
                  (prompt.trim().length === 0 && attachedImages.length === 0)
                }
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
