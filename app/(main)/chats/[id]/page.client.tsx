"use client";

import { createMessage } from "@/app/(main)/actions";
import LogoSmall from "@/components/icons/logo-small";
import { ArrowLeftIcon } from "lucide-react";
import {
  parseReplySegments,
  extractFirstCodeBlock,
  extractAllCodeBlocks,
  getFilesFromMessage,
  sanitizeAssistantOutput,
} from "@/lib/utils";
import {
  FIX_REQUEST_PREFIX,
  describePathlessFenceProblem,
  shouldAllowAutoFix,
} from "@/lib/chat-auto-fix";
import { createLocalChatTitle } from "@/lib/chat-title";
import { useRouter } from "next/navigation";
import {
  memo,
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
// ChatCompletionStream from the OpenAI SDK was replaced with a manual SSE
// parser below — the SDK's fromReadableStream() silently failed to emit
// finalContent on AWS Amplify (Lambda buffers the entire response into one
// chunk, and the SDK's event-emitter doesn't fire end events reliably).
import ChatBox from "./chat-box";
import ChatLog from "./chat-log";
import CodeViewer from "./code-viewer";
import CodeViewerLayout from "./code-viewer-layout";
import ErrorDialog from "./error-dialog";
import type { Chat, Message } from "./page";
import { Context } from "../../providers";

// Safety net: if a stream produces no content for 90s (or never
// completes within 6 minutes total), treat it as failed. Without this,
// a hung network connection or a server crash leaves `streamPromise` set
// forever, which keeps the input disabled and the spinner spinning — the
// "always working mode" symptom.
const STREAM_IDLE_TIMEOUT_MS = 90_000;
const STREAM_HARD_TIMEOUT_MS = 6 * 60_000;

const HeaderChat = memo(({ title }: { title: string }) => (
  <div className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3">
    <a
      href="/"
      className="flex shrink-0 items-center gap-1.5 rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
      title="Back to home"
    >
      <ArrowLeftIcon className="size-4" />
      <LogoSmall />
    </a>
    <span className="text-gray-200" aria-hidden="true">|</span>
    <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">{title}</p>
  </div>
));

HeaderChat.displayName = "HeaderChat";

export default function PageClient({ chat }: { chat: Chat }) {
  const context = use(Context);
  const [chatTitle, setChatTitle] = useState(chat.title);
  const [streamPromise, setStreamPromise] = useState<
    Promise<ReadableStream> | undefined
  >(context.streamPromise);
  // M15: sync local streamPromise from context if it changes after mount
  // (e.g. home-client sets it after this component already mounted via
  // back/forward cache). Without this the stream effect never fires for a
  // context-only update.
  useEffect(() => {
    if (context.streamPromise && !streamPromise) {
      setStreamPromise(context.streamPromise);
    }
  }, [context.streamPromise, streamPromise]);
  const [streamText, setStreamText] = useState("");
  const [isShowingCodeViewer, setIsShowingCodeViewer] = useState(
    chat.messages.some((m) => m.role === "assistant"),
  );
  const [activeTab, setActiveTab] = useState<"code" | "preview">("preview");
  const router = useRouter();
  const isHandlingStreamRef = useRef(false);
  const isUpdatingTitleRef = useRef(false);
  // AbortController for the in-flight stream — used by the Stop button
  // and by the idle/hard timeouts to cancel the fetch.
  const abortControllerRef = useRef<AbortController | null>(null);
  // The underlying ReadableStream from the fetch response. Stored so
  // stopGeneration() can cancel it, which terminates the ChatCompletionStream
  // reader and stops on("content") callbacks from firing after the user
  // has moved on. Without this, a stopped generation keeps overwriting
  // streamText in the background.
  const activeStreamRef = useRef<ReadableStream<Uint8Array> | null>(null);
  // Watchdog cancel function for the in-flight stream — stored so the
  // useEffect cleanup can cancel it on unmount.
  const cancelWatchdogRef = useRef<(() => void) | null>(null);
  // Track whether at least one content chunk has arrived, so the idle
  // timeout can tell "model is still thinking, no output yet" from
  // "stream genuinely went silent mid-generation".
  const lastContentAtRef = useRef<number>(0);
  const streamStartedAtRef = useRef<number>(0);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [activeMessage, setActiveMessage] = useState(
    chat.messages
      .filter((m) => m.role === "assistant" && extractFirstCodeBlock(m.content))
      .at(-1),
  );

  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [isFixPending, setIsFixPending] = useState(false);
  const autoFixMessageIdsRef = useRef<Set<string>>(new Set());

  const allowAutoFix = useMemo(() => {
    return shouldAllowAutoFix({
      messages: chat.messages,
      activeMessage,
      streamText,
      autoFixMessageIds: autoFixMessageIdsRef.current,
    });
  }, [chat, activeMessage, streamText]);

  // Track elapsed seconds since the stream started, for the UI banner.
  const [streamElapsedMs, setStreamElapsedMs] = useState(0);
  useEffect(() => {
    if (!streamPromise) {
      setStreamElapsedMs(0);
      return;
    }
    const id = window.setInterval(() => {
      if (streamStartedAtRef.current) {
        setStreamElapsedMs(Date.now() - streamStartedAtRef.current);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [streamPromise]);

  useEffect(() => {
    if (isUpdatingTitleRef.current) return;
    if (chat.title !== createLocalChatTitle(chat.prompt)) return;

    isUpdatingTitleRef.current = true;
    const controller = new AbortController();

    fetch("/api/generate-chat-title", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: chat.id }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : undefined))
      .then((data) => {
        if (typeof data?.title === "string") {
          setChatTitle(data.title);
        }
      })
      .catch(() => {
        isUpdatingTitleRef.current = false;
      });

    return () => controller.abort();
  }, [chat.id, chat.prompt, chat.title]);

  // Reset the stuck-stream safety net whenever a new stream starts.
  // Returns a cleanup function that clears the timers.
  function scheduleStreamWatchdog(
    onIdleTimeout: () => void,
    onHardTimeout: () => void,
  ) {
    lastContentAtRef.current = Date.now();
    streamStartedAtRef.current = Date.now();

    const idleId = window.setInterval(() => {
      const sinceLast = Date.now() - lastContentAtRef.current;
      const sinceStart = Date.now() - streamStartedAtRef.current;
      if (sinceLast >= STREAM_IDLE_TIMEOUT_MS) {
        window.clearInterval(idleId);
        window.clearTimeout(hardId);
        onIdleTimeout();
      } else if (sinceStart >= STREAM_HARD_TIMEOUT_MS) {
        window.clearInterval(idleId);
        window.clearTimeout(hardId);
        onHardTimeout();
      }
    }, 5_000);

    const hardId = window.setTimeout(() => {
      window.clearInterval(idleId);
      onHardTimeout();
    }, STREAM_HARD_TIMEOUT_MS);

    return () => {
      window.clearInterval(idleId);
      window.clearTimeout(hardId);
    };
  }

  function resetStreamState() {
    isHandlingStreamRef.current = false;
    setStreamText("");
    setStreamPromise(undefined);
    setStreamElapsedMs(0);
    // CRITICAL: do NOT clear streamError here. The error handlers call
    // setStreamError(...) and then resetStreamState() in the same tick —
    // if we wipe the error here, React batches both updates and the user
    // never sees the error message. The error stays visible in the
    // ErrorDialog until the user dismisses it or starts a new generation
    // (which clears it via setStreamError(null) in the stream-start path).
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (activeStreamRef.current) {
      try {
        activeStreamRef.current.cancel();
      } catch {
        // Stream may already be closed; ignore.
      }
      activeStreamRef.current = null;
    }
    streamStartedAtRef.current = 0;
    lastContentAtRef.current = 0;
  }

  // Stop the in-flight generation. Used by the Stop button. The
  // ChatCompletionStream has no public abort, so we abort the underlying
  // fetch and let the stream error out, which the catch below turns into
  // a clean state reset.
  const stopGeneration = useCallback(() => {
    resetStreamState();
  }, []);

  useEffect(() => {
    async function f() {
      if (!streamPromise || isHandlingStreamRef.current) return;

      isHandlingStreamRef.current = true;
      context.setStreamPromise(undefined);
      setStreamError(null);
      // Show the code viewer panel as soon as a stream starts, even before
      // any code blocks arrive. Previously the panel only appeared when a
      // `file` segment was detected in the stream content — but models
      // often spend 30-60s on prose planning before emitting code, and
      // during that window the panel was hidden, making the page look
      // broken. Now the panel stays open for the entire stream lifecycle.
      setIsShowingCodeViewer(true);

      // Cancel any previous controller (shouldn't happen, but cheap to guard).
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Note: this controller only aborts *our* bookkeeping; the fetch
      // was started by the caller (home-client or chat-box) and may not
      // accept this signal. We still track it so stopGeneration() can
      // short-circuit the stream-processing promise below.
      const localController = new AbortController();
      abortControllerRef.current = localController;

      const cancelWatchdog = scheduleStreamWatchdog(
        () => {
          // Idle timeout: no content for 90s. Abort and surface a clear
          // error so the user knows the model went silent, not the UI.
          if (localController.signal.aborted) return;
          localController.abort();
          setStreamError(
            "The model stopped responding (no output for 90 seconds). The connection may have dropped — try sending the prompt again.",
          );
          resetStreamState();
        },
        () => {
          // Hard timeout: 6 minutes total. Same recovery.
          if (localController.signal.aborted) return;
          localController.abort();
          setStreamError(
            "Generation timed out after 6 minutes. Please try again or simplify your prompt.",
          );
          resetStreamState();
        },
      );
      cancelWatchdogRef.current = cancelWatchdog;

      let stream: ReadableStream<Uint8Array> | undefined;
      try {
        stream = await streamPromise;
        activeStreamRef.current = stream;
      } catch (err) {
        cancelWatchdog();
        setStreamError(
          err instanceof Error
            ? `Failed to start generation: ${err.message}`
            : "Failed to start generation.",
        );
        resetStreamState();
        return;
      }

      if (localController.signal.aborted) {
        cancelWatchdog();
        // If the user already hit Stop while we were awaiting the fetch,
        // make sure the stream is cancelled.
        try {
          stream?.cancel();
        } catch {
          // ignore
        }
        return;
      }

      let didPushToCode = false;
      let didPushToPreview = false;

      try {
        // ── Manual SSE parser (replaces ChatCompletionStream.fromReadableStream) ──
        // The OpenAI SDK's fromReadableStream() was silently failing to emit
        // finalContent on AWS Amplify (likely due to how Lambda buffers the
        // response into a single chunk).  This manual parser reads the SSE
        // stream directly, accumulates content deltas, and calls the same
        // handlers (content → finalContent) that the SDK would have called.
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let fullContent = "";
        let streamBuffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;

          // Mark activity for the idle watchdog
          lastContentAtRef.current = Date.now();

          streamBuffer += decoder.decode(value, { stream: true });

          // Process complete SSE events (separated by \n\n)
          const events = streamBuffer.split("\n\n");
          streamBuffer = events.pop() ?? ""; // last incomplete event stays in buffer

          for (const event of events) {
            const lines = event.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6);
              if (payload === "[DONE]") {
                continue;
              }
              try {
                const ev = JSON.parse(payload);
                const delta = ev.choices?.[0]?.delta;
                if (delta?.content) {
                  fullContent += delta.content;
                  // Update the UI with accumulated content (sanitized)
                  setStreamText(() => sanitizeAssistantOutput(fullContent));

                  if (
                    !didPushToCode &&
                    parseReplySegments(fullContent).some(
                      (seg) => seg.type === "file",
                    )
                  ) {
                    didPushToCode = true;
                    setIsShowingCodeViewer(true);
                    setActiveTab("code");
                  }

                  if (
                    !didPushToPreview &&
                    parseReplySegments(fullContent).some(
                      (seg) => seg.type === "file" && !seg.isPartial,
                    )
                  ) {
                    didPushToPreview = true;
                    setIsShowingCodeViewer(true);
                  }
                }
              } catch {
                // JSON parse error on a single line — skip, don't crash
              }
            }
          }
        }

        // Stream complete — emit finalContent
        cancelWatchdog();
        const finalText = sanitizeAssistantOutput(fullContent);
        try {
          await startTransition(async () => {
            // Get all previous assistant messages with files
            const previousAssistantMessages = chat.messages.filter(
              (m) =>
                m.role === "assistant" &&
                extractAllCodeBlocks(m.content).length > 0,
            );

            // Extract all files from previous messages
            const previousFiles = previousAssistantMessages.flatMap(
              (msg) => extractAllCodeBlocks(msg.content),
            );

            // Extract files from current AI response
            const currentFiles = extractAllCodeBlocks(finalText);

            // Merge files (current overrides previous for same paths)
            const fileMap = new Map();
            previousFiles.forEach((file) => fileMap.set(file.path, file));
            currentFiles.forEach((file) => fileMap.set(file.path, file));
            const allFiles = Array.from(fileMap.values());

            const message = await createMessage(
              chat.id,
              finalText,
              "assistant",
              allFiles,
            );

            startTransition(() => {
              isHandlingStreamRef.current = false;
              setStreamText("");
              setStreamPromise(undefined);
              setStreamElapsedMs(0);
              setStreamError(null);
              abortControllerRef.current = null;
              activeStreamRef.current = null;
              setActiveMessage(message);
              setIsShowingCodeViewer(true);
              setActiveTab("preview");
              router.refresh();
            });
          });
        } catch (err) {
          setStreamError(
            err instanceof Error
              ? `Failed to save response: ${err.message}`
              : "Failed to save response.",
          );
          resetStreamState();
        }
      } catch (err) {
        cancelWatchdog();
        setStreamError(
          err instanceof Error
            ? `Generation failed: ${err.message}`
            : "Generation failed unexpectedly.",
        );
        resetStreamState();
      }
    }

    f();

    // Cleanup on unmount: cancel watchdog, abort controller, cancel stream.
    // Prevents DB writes to stale chats + resource leaks when the user
    // navigates away mid-generation.
    return () => {
      cancelWatchdogRef.current?.();
      cancelWatchdogRef.current = null;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (activeStreamRef.current) {
        try {
          activeStreamRef.current.cancel();
        } catch {
          // already cancelled
        }
        activeStreamRef.current = null;
      }
    };
  }, [chat.id, router, streamPromise, context]);

  const submitFix = useCallback(
    async (error: string) => {
      if (isFixPending) return;

      setIsFixPending(true);
      // A bundler "Cannot resolve" on a response whose fences carried no
      // {path=...} is a symptom; tell the model about the missing path tags
      // instead so it re-sends the files correctly rather than hunting for a
      // code bug it doesn't have.
      const previewedMessage =
        activeMessage ??
        [...chat.messages].reverse().find((m) => m.role === "assistant");
      const problem = previewedMessage
        ? describePathlessFenceProblem(previewedMessage.content)
        : null;
      const newMessageText = `${FIX_REQUEST_PREFIX}\n\n${(problem ?? error).trimStart()}`;
      const optimistic: Message = {
        id: `optimistic-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: "user",
        content: newMessageText,
        createdAt: new Date(),
        updatedAt: new Date(),
        chatId: chat.id,
        position: Number.MAX_SAFE_INTEGER,
        files: null,
      } as Message;
      setOptimisticMessages((prev) => [...prev, optimistic]);

      startTransition(async () => {
        const message = await createMessage(chat.id, newMessageText, "user");
        autoFixMessageIdsRef.current.add(message.id);
        setOptimisticMessages((prev) =>
          prev.filter((m) => m.id !== optimistic.id),
        );

        const nextStreamPromise = fetch(
          "/api/get-next-completion-stream-promise",
          {
            method: "POST",
            body: JSON.stringify({
              messageId: message.id,
              model: chat.model,
            }),
          },
        ).then(async (res) => {
          if (!res.ok) {
            const data = await res.json().catch(() => null);
            throw new Error(data?.error ?? `Request failed (HTTP ${res.status})`);
          }
          if (!res.body) {
            throw new Error("No body on response");
          }
          return res.body;
        });

        setStreamPromise(nextStreamPromise);
        router.refresh();
      });
    },
    [chat, isFixPending, router, activeMessage],
  );

  useEffect(() => {
    if (!streamPromise) {
      setIsFixPending(false);
      setOptimisticMessages([]);
    }
  }, [streamPromise]);

  const chatForChatLog = useMemo<Chat>(() => {
    const existingUserContents = new Set(
      chat.messages.filter((m) => m.role === "user").map((m) => m.content),
    );
    const missingOptimistic = optimisticMessages.filter(
      (m) => !existingUserContents.has(m.content),
    );
    return {
      ...chat,
      messages: [...chat.messages, ...missingOptimistic],
    } as Chat;
  }, [chat, optimisticMessages]);

  // While a stream is in-flight, show the CodeViewer panel even before
  // any code arrives — the empty state ("Building your app…") is far
  // less alarming than a missing panel that the user can't explain.
  // Also keep the panel visible when there's a streamError so the error
  // banner inside the panel is shown (rather than the panel vanishing
  // and leaving a blank page).
  const showViewerWhileStreaming = !!streamPromise;
  const effectiveShowViewer =
    isShowingCodeViewer || showViewerWhileStreaming || !!streamError;

  return (
    <div className="h-dvh">
      <div className="flex h-full">
        <div
          className={`flex w-full shrink-0 flex-col overflow-hidden ${
            effectiveShowViewer ? "lg:w-[30%]" : "lg:w-full"
          }`}
        >
          <HeaderChat title={chatTitle} />

          <ChatLog
            chat={chatForChatLog}
            streamText={streamText}
            activeMessage={activeMessage}
            onMessageClick={(message) => {
              if (message !== activeMessage) {
                setActiveMessage(message);
                setIsShowingCodeViewer(true);
              } else {
                setActiveMessage(undefined);
                setIsShowingCodeViewer(false);
              }
            }}
          />

          <ChatBox
            chat={chat}
            onNewStreamPromise={setStreamPromise}
            isStreaming={!!streamPromise}
            onStopGeneration={stopGeneration}
            streamElapsedMs={streamElapsedMs}
          />
        </div>

        <CodeViewerLayout
          isShowing={effectiveShowViewer}
          onClose={() => {
            // Don't allow closing the viewer while streaming — the
            // panel is the only place the user can see generation
            // progress, and hiding it would recreate the "stuck" feel.
            if (streamPromise) return;
            setActiveMessage(undefined);
            setIsShowingCodeViewer(false);
          }}
        >
          {effectiveShowViewer && (
            <CodeViewer
              streamText={streamText}
              chat={chat}
              message={activeMessage}
              onMessageChange={setActiveMessage}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onClose={() => {
                if (streamPromise) return;
                setActiveMessage(undefined);
                setIsShowingCodeViewer(false);
              }}
              onRequestFix={submitFix}
              isFixPending={isFixPending}
              allowAutoFix={allowAutoFix}
              isStreaming={!!streamPromise}
              streamError={streamError}
              streamElapsedMs={streamElapsedMs}
              onStopGeneration={stopGeneration}
              onRestore={async (
                message: Message | undefined,
                oldVersion: number,
                newVersion: number,
              ) => {
                startTransition(async () => {
                  if (!message) return;

                  const restoredFiles = getFilesFromMessage(message);
                  if (restoredFiles.length === 0) return;

                  const explanation = `Version ${newVersion} was created by restoring version ${oldVersion}.`;
                  const newContent =
                    explanation +
                    "\n\n" +
                    restoredFiles
                      .map(
                        (file) =>
                          `\`\`\`${file.language}{path=${file.path}}\n${file.code}\n\`\`\``,
                      )
                      .join("\n\n");

                  const newMessage = await createMessage(
                    chat.id,
                    newContent,
                    "assistant",
                    restoredFiles,
                  );
                  setActiveMessage(newMessage);
                  router.refresh();
                });
              }}
            />
          )}
        </CodeViewerLayout>
      </div>

      <ErrorDialog
        error={streamError}
        onClose={() => setStreamError(null)}
      />
    </div>
  );
}
