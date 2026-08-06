"use client";

import CloseIcon from "@/components/icons/close-icon";
import RefreshIcon from "@/components/icons/refresh";
import { DownloadIcon, GitBranch } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  extractAllCodeBlocks,
  generateIntelligentFilename,
  getFilesFromMessage,
  parseReplySegments,
  toTitleCase,
} from "@/lib/utils";
import { useState, useEffect } from "react";
import type { Chat, Message } from "./page";
import { Share } from "./share";
import { StickToBottom } from "use-stick-to-bottom";
import JSZip from "jszip";
import dynamic from "next/dynamic";
import GitHubPushDialog from "./github-push-dialog";

const CodeRunner = dynamic(() => import("@/components/code-runner"), {
  ssr: false,
});
const SyntaxHighlighter = dynamic(
  () => import("@/components/syntax-highlighter"),
  {
    ssr: false,
  },
);

export default function CodeViewer({
  chat,
  streamText,
  message,
  onMessageChange,
  activeTab,
  onTabChange,
  onClose,
  onRequestFix,
  onRestore,
  isFixPending,
  allowAutoFix,
  isStreaming,
  streamError,
  streamElapsedMs,
  onStopGeneration,
}: {
  chat: Chat;
  streamText: string;
  message?: Message;
  onMessageChange: (v: Message) => void;
  activeTab: string;
  onTabChange: (v: "code" | "preview") => void;
  onClose: () => void;
  onRequestFix: (e: string) => void;
  onRestore: (
    message: Message | undefined,
    oldVersion: number,
    newVersion: number,
  ) => void;
  isFixPending?: boolean;
  allowAutoFix?: boolean;
  isStreaming?: boolean;
  streamError?: string | null;
  streamElapsedMs?: number;
  onStopGeneration?: () => void;
}) {
  const streamAllFiles = extractAllCodeBlocks(streamText);

  // Extract the latest (possibly partial) code fence from the stream text
  function extractLatestStreamBlock(
    input: string,
  ): { code: string; language: string; path: string } | undefined {
    if (!input) return undefined;
    // Reuse the shared parser so the streaming view agrees with the stored
    // result (handles GLM's next-line `{path=...}` attribute, dedupe, etc.).
    const fileSegments = parseReplySegments(input).filter(
      (s): s is Extract<typeof s, { type: "file" }> => s.type === "file",
    );
    return fileSegments.at(-1);
  }

  const latestStreamBlock = extractLatestStreamBlock(streamText);

  // Merge stream files with latest partial if necessary
  let mergedStreamFiles = [...streamAllFiles];
  if (latestStreamBlock) {
    const existingIdx = mergedStreamFiles.findIndex(
      (f) => f.path === latestStreamBlock.path,
    );
    if (existingIdx !== -1) {
      mergedStreamFiles[existingIdx] = {
        code: latestStreamBlock.code,
        language: latestStreamBlock.language,
        path: latestStreamBlock.path,
        fullMatch: "",
      };
    } else {
      mergedStreamFiles.push({
        code: latestStreamBlock.code,
        language: latestStreamBlock.language,
        path: latestStreamBlock.path,
        fullMatch: "",
      });
    }
  }

  // Utility to merge base files with overlay files (overlay wins on conflicts)
  function mergeFiles(
    base: Array<{
      code: string;
      language: string;
      path: string;
      fullMatch: string;
    }>,
    overlay: Array<{
      code: string;
      language: string;
      path: string;
      fullMatch: string;
    }>,
  ) {
    const map = new Map<
      string,
      { code: string; language: string; path: string; fullMatch: string }
    >();
    base.forEach((f) => map.set(f.path, f));
    overlay.forEach((f) => map.set(f.path, f));
    return Array.from(map.values());
  }

  // Since each message now contains cumulative files, simplify the logic
  const assistantMessages = chat.messages.filter(
    (m) => m.role === "assistant" && getFilesFromMessage(m).length > 0,
  );

  // Effective files:
  // - While streaming: use the last message's cumulative files overlaid with streamed partials
  // - When displaying a message: use that message's cumulative files directly
  const files = streamText
    ? (() => {
        const lastMessage = assistantMessages.at(-1);
        const baseFiles = lastMessage ? getFilesFromMessage(lastMessage) : [];
        return mergeFiles(baseFiles, mergedStreamFiles);
      })()
    : message
      ? getFilesFromMessage(message)
      : [];

  // Prefer the latest streamed file while streaming; otherwise, App.tsx or first tsx
  const mainFile =
    latestStreamBlock && streamText
      ? files.find((f) => f.path === latestStreamBlock.path) || files.at(-1)
      : files.find((f) => f.path === "App.tsx") ||
        files.find((f) => f.path.endsWith(".tsx")) ||
        files[0];
  const language = mainFile ? mainFile.language : "";

  // Generate app title for display
  const generateAppTitle = (fileList: typeof files) => {
    if (fileList.length === 1) {
      return generateIntelligentFilename(fileList[0].code, fileList[0].language)
        .name;
    }

    // For multiple files, look for App.tsx or main component
    const appFile = fileList.find(
      (f) => f.path === "App.tsx" || f.path.endsWith("App.tsx"),
    );
    if (appFile) {
      const appMatch = appFile.code.match(
        /function\s+(\w+App|\w+Component|\w+)/,
      );
      if (appMatch) {
        return toTitleCase(appMatch[1].replace(/(App|Component)$/, ""));
      }
    }

    // Fallback: use the first file's name
    const firstFile = fileList[0];
    if (firstFile) {
      const name =
        firstFile.path
          .split("/")
          .pop()
          ?.replace(/\.\w+$/, "") || "App";
      return toTitleCase(name.replace(/(App|Component)$/, ""));
    }

    return "App";
  };

  const appTitle = generateAppTitle(files);

  const allAssistantMessages = assistantMessages.some(
    (m) => m.id === message?.id,
  )
    ? assistantMessages
    : message && getFilesFromMessage(message).length > 0
      ? [...assistantMessages, message]
      : assistantMessages;
  const reversedAllAssistantMessages = allAssistantMessages.slice().reverse();
  const currentVersionIndex =
    streamAllFiles.length > 0
      ? allAssistantMessages.length
      : message && allAssistantMessages.some((m) => m.id === message.id)
        ? allAssistantMessages.map((m) => m.id).indexOf(message.id)
        : allAssistantMessages.length - 1;
  const currentVersion =
    (chat.assistantMessagesCountBefore || 0) + currentVersionIndex;

  const [refresh, setRefresh] = useState(0);
  const [githubOpen, setGithubOpen] = useState(false);
  const disabledControls = !!streamText || files.length === 0;
  const selectValue = disabledControls
    ? undefined
    : (allAssistantMessages.length - 1 - currentVersionIndex).toString();

  const timeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleDownloadFiles = async () => {
    if (files.length === 0) return;

    const zip = new JSZip();

    // Add each file to the zip
    files.forEach((file) => {
      zip.file(file.path, file.code);
    });

    // Generate the zip file
    const content = await zip.generateAsync({ type: "blob" });

    // Generate app title for filename
    const appTitle = generateAppTitle(files);
    const filename = `${appTitle.replace(/[^a-zA-Z0-9]/g, "-")}-codewix.zip`;

    // Create a download link and trigger the download
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Files downloaded!",
      description: `${files.length} files downloaded as ${filename}`,
      variant: "default",
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // M10: don't close the code panel when a dialog (GitHubPushDialog, etc.)
      // is open — baseui Dialog doesn't stop propagation on window-level
      // keydown, so without this guard pressing Escape to dismiss a dialog
      // also closes the code panel.
      if (e.key === "Escape" && !e.defaultPrevented) {
        const dialogOpen = document.querySelector("[role='dialog'], [data-state='open']");
        if (!dialogOpen) {
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <div
        className="flex h-16 shrink-0 items-center justify-between border-b border-gray-300 px-4"
        style={{ backgroundColor: "#B2D5E5" }}
      >
        <div className="inline-flex items-center gap-4">
          <button
            className="hidden text-gray-600 hover:text-gray-900 md:block"
            onClick={onClose}
            title="Close panel"
          >
            <CloseIcon className="size-5" />
          </button>
          <span className="hidden font-semibold text-gray-800 md:block">
            {appTitle}
          </span>
          {!disabledControls && (
            <Select
              value={selectValue}
              onValueChange={(value) => {
                if (value === null) return;
                onMessageChange(
                  reversedAllAssistantMessages[parseInt(value)],
                );
              }}
              disabled={disabledControls}
            >
              <SelectTrigger className="h-[38px] w-16 bg-white text-sm font-semibold !outline-none !ring-0 !ring-transparent">
                <SelectValue>{`v${currentVersion + 1}`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {reversedAllAssistantMessages.map((msg, i) => (
                  <SelectItem key={i} value={i.toString()}>
                    <span className="flex flex-col">
                      <span className="font-semibold">
                        v
                        {(chat.assistantMessagesCountBefore || 0) +
                          (allAssistantMessages.length - 1 - i) +
                          1}
                      </span>
                      <span className="text-xs text-gray-500">
                        {timeAgo(msg.createdAt)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {currentVersionIndex < allAssistantMessages.length - 1 && message && (
            <button
              onClick={() =>
                onRestore(
                  message,
                  currentVersion + 1,
                  (chat.assistantMessagesCountBefore || 0) +
                    allAssistantMessages.length +
                    1,
                )
              }
              className="inline-flex h-[38px] items-center justify-center rounded bg-blue-500 px-2 text-xs font-medium text-white hover:bg-blue-600"
            >
              Restore
            </button>
          )}
        </div>

        {/* Right side: Code/Preview toggle + action buttons (Share, Refresh, Download, GitHub) */}
        <div className="flex items-center gap-2">
          <div className="rounded-lg border-2 border-gray-400 bg-white/60 p-1">
            <button
              onClick={() => onTabChange("code")}
              data-active={activeTab === "code" ? true : undefined}
              disabled={disabledControls}
              className="inline-flex h-7 w-16 items-center justify-center rounded text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 data-[active]:bg-blue-500 data-[active]:text-white"
            >
              Code
            </button>
            <button
              onClick={() => onTabChange("preview")}
              data-active={activeTab === "preview" ? true : undefined}
              disabled={disabledControls}
              className="inline-flex h-7 w-16 items-center justify-center rounded text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 data-[active]:bg-blue-500 data-[active]:text-white"
            >
              Preview
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Share
              message={
                disabledControls
                  ? undefined
                  : message && streamAllFiles.length === 0
                    ? message
                    : undefined
              }
            />
            <button
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-400 bg-white/70 px-2.5 text-xs font-medium text-gray-700 transition enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setRefresh((r) => r + 1)}
              disabled={disabledControls}
              title="Refresh preview"
            >
              <RefreshIcon className="size-3" />
              <span className="hidden lg:inline">Refresh</span>
            </button>
            <button
              className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-gray-400 bg-white/70 px-2.5 text-xs font-medium text-gray-700 transition enabled:hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleDownloadFiles}
              disabled={disabledControls}
              title="Download files (.zip)"
            >
              <DownloadIcon className="size-3" />
              <span className="hidden lg:inline">Download</span>
            </button>
            <button
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-gray-900 px-3 text-xs font-medium text-white transition enabled:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => setGithubOpen(true)}
              disabled={files.length === 0}
              title="Push to GitHub"
            >
              <GitBranch className="size-3.5" />
              <span className="hidden lg:inline">Push to GitHub</span>
            </button>
          </div>
        </div>
      </div>

      <div className="relative flex grow flex-col overflow-y-auto bg-white">
        {/* Error banner: shown when the stream failed (network, timeout,
            server error). Surfaces the message inline so the user knows
            why nothing is rendering, instead of just seeing a blank panel. */}
        {streamError && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <div className="flex items-start gap-2">
              <svg
                className="mt-0.5 size-4 shrink-0 text-red-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.94 7.94a1 1 0 11-2 0 1 1 0 012 0zM9 10a1 1 0 011-1h.01a1 1 0 01.99 1.13l-.5 4a1 1 0 11-1.98-.26l.5-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="font-medium">Generation failed</p>
                <p className="mt-0.5 text-xs text-red-600">{streamError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Streaming placeholder: attractive 3D animated "Building your app"
            scene. Bright gradient background (no black), orbiting cubes,
            pulsing rings, and floating sparkles. Premium SaaS feel. */}
        {isStreaming && files.length === 0 && !streamError && (
          <div
            className="cw-gradient-bg relative flex grow flex-col items-center justify-center gap-8 overflow-hidden px-6 py-12 text-center"
            style={{ perspective: "800px" }}
          >
            {/* Floating background sparkles */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div
                className="cw-float-up absolute left-[15%] top-[80%] size-2 rounded-full bg-white/80"
                style={{ animationDelay: "0s" }}
              />
              <div
                className="cw-float-up absolute left-[35%] top-[80%] size-1.5 rounded-full bg-pink-200"
                style={{ animationDelay: "0.8s" }}
              />
              <div
                className="cw-float-up absolute left-[55%] top-[80%] size-2.5 rounded-full bg-cyan-200"
                style={{ animationDelay: "1.6s" }}
              />
              <div
                className="cw-float-up absolute left-[75%] top-[80%] size-1.5 rounded-full bg-purple-200"
                style={{ animationDelay: "2.4s" }}
              />
              <div
                className="cw-float-up absolute left-[25%] top-[80%] size-1 rounded-full bg-yellow-200"
                style={{ animationDelay: "1.2s" }}
              />
              <div
                className="cw-float-up absolute left-[85%] top-[80%] size-2 rounded-full bg-white/70"
                style={{ animationDelay: "2s" }}
              />
            </div>

            {/* Pulsing rings behind the central cube */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div
                className="cw-pulse-ring absolute -left-20 -top-20 size-40 rounded-full border-2 border-cyan-300/60"
                style={{ animationDelay: "0s" }}
              />
              <div
                className="cw-pulse-ring absolute -left-20 -top-20 size-40 rounded-full border-2 border-purple-300/60"
                style={{ animationDelay: "0.7s" }}
              />
              <div
                className="cw-pulse-ring absolute -left-20 -top-20 size-40 rounded-full border-2 border-pink-300/60"
                style={{ animationDelay: "1.4s" }}
              />
            </div>

            {/* Central animated cube + orbiting satellites */}
            <div
              className="relative flex size-32 items-center justify-center"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Central rotating cube */}
              <div
                className="cw-cube-spin size-16"
                style={{
                  transformStyle: "preserve-3d",
                  background:
                    "linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #f472b6 100%)",
                  borderRadius: "12px",
                  boxShadow:
                    "0 12px 32px rgba(96,165,250,0.45), 0 4px 12px rgba(167,139,250,0.35)",
                }}
              />
              {/* Orbiting satellite 1 */}
              <div
                className="cw-orbit absolute left-1/2 top-1/2 size-4 rounded-full bg-cyan-400 shadow-lg shadow-cyan-300/50"
                style={{ marginLeft: "-8px", marginTop: "-8px" }}
              />
              {/* Orbiting satellite 2 (reverse, larger orbit) */}
              <div
                className="cw-orbit-reverse absolute left-1/2 top-1/2 size-3 rounded-full bg-pink-400 shadow-lg shadow-pink-300/50"
                style={{ marginLeft: "-6px", marginTop: "-6px" }}
              />
              {/* Orbiting satellite 3 (offset start) */}
              <div
                className="cw-orbit absolute left-1/2 top-1/2 size-3 rounded-full bg-yellow-300 shadow-lg shadow-yellow-200/50"
                style={{
                  marginLeft: "-6px",
                  marginTop: "-6px",
                  animationDelay: "-2s",
                }}
              />
            </div>

            <div className="cw-bob space-y-2">
              <p className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-2xl font-bold text-transparent">
                Building your app
              </p>
              <p className="max-w-xs text-sm font-medium text-gray-700">
                {streamText
                  ? "Structuring files — code will appear here shortly."
                  : "The model is thinking through your request. This can take 30-60 seconds for complex apps."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {typeof streamElapsedMs === "number" &&
                streamElapsedMs > 0 && (
                  <span className="rounded-full bg-white/80 px-3 py-1 font-mono text-xs font-medium text-blue-700 shadow-sm backdrop-blur">
                    {formatElapsed(streamElapsedMs)}
                  </span>
                )}
              {onStopGeneration && (
                <button
                  type="button"
                  onClick={onStopGeneration}
                  className="rounded-lg border border-blue-300 bg-white/90 px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm transition hover:bg-white"
                >
                  Stop generation
                </button>
              )}
            </div>
          </div>
        )}

        <div
          className={
            activeTab === "code" && (files.length > 0 || !isStreaming)
              ? "flex grow flex-col overflow-hidden"
              : "hidden"
          }
        >
          <StickToBottom
            className="relative grow overflow-hidden *:!h-[inherit]"
            resize="smooth"
            initial={false}
          >
            <StickToBottom.Content>
              <SyntaxHighlighter
                files={files.map((f) => ({
                  path: f.path,
                  content: f.code,
                  language: f.language,
                }))}
                activePath={
                  streamText
                    ? latestStreamBlock?.path || files.at(-1)?.path
                    : undefined
                }
                disableSelection={!!streamText}
                isStreaming={!!streamText}
              />
            </StickToBottom.Content>
          </StickToBottom>
        </div>
        {files.length > 0 && (
          // Mounted as soon as files exist — even while streaming on the Code
          // tab — so the preview pre-warms in the background (bundle, vendor
          // fetches, tailwind CSS) and is ready the moment the tab opens.
          // Auto-fix is disabled while streaming, so partial-bundle errors
          // in the hidden runner are harmless.
          <div
            className={
              activeTab === "preview"
                ? "flex flex-1 min-h-0 items-center justify-center"
                : "pointer-events-none absolute inset-0 flex flex-1 min-h-0 items-center justify-center opacity-0"
            }
            aria-hidden={activeTab !== "preview"}
          >
            <CodeRunner
              onRequestFix={onRequestFix}
              language={language}
              files={files.map((f) => ({ path: f.path, content: f.code }))}
              refreshNonce={refresh}
              previewDebounceMs={streamText ? 400 : 0}
              isFixPending={isFixPending}
              allowAutoFix={allowAutoFix}
              isActivePane={activeTab === "preview"}
            />
          </div>
        )}
      </div>

      <GitHubPushDialog
        open={githubOpen}
        onOpenChange={setGithubOpen}
        files={files.map((f) => ({ path: f.path, content: f.code }))}
        appTitle={appTitle}
      />
    </>
  );
}

function formatElapsed(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}
