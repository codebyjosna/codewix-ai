"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import JSZip from "jszip";

// Push the generated files to a GitHub repository. This runs entirely
// client-side using the GitHub REST API — the user provides a personal
// access token (PAT) with `repo` scope, which is used only for this
// request and never stored. We send each file as a separate
// create-or-update-blob via the Contents API; for many files this is
// simpler than building a Git tree + commit + ref update, and is fast
// enough for typical generated-app sizes (<50 files, <500KB total).
//
// Privacy: the PAT is held in component state only while the dialog is
// open and is sent directly to api.github.com. It is NOT logged, NOT
// persisted, NOT proxied through our server.

type PushState = "idle" | "creating" | "pushing" | "done" | "error";

type FileEntry = { path: string; content: string };

export default function GitHubPushDialog({
  open,
  onOpenChange,
  files,
  appTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  files: FileEntry[];
  appTitle: string;
}) {
  const [token, setToken] = useState("");
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [state, setState] = useState<PushState>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  const defaultRepoName = (appTitle || "codewix-app")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "codewix-app";

  function reset() {
    setState("idle");
    setProgress("");
    setError(null);
  }

  async function handlePush() {
    if (!token.trim()) {
      setError("A GitHub personal access token is required (repo scope).");
      return;
    }
    if (!owner.trim()) {
      setError("GitHub username or organization is required.");
      return;
    }
    if (!repo.trim()) {
      setError("Repository name is required.");
      return;
    }
    if (files.length === 0) {
      setError("No files to push — generate something first.");
      return;
    }

    setState("creating");
    setError(null);
    setProgress(`Checking repo ${owner}/${repo}…`);

    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      };

      // 1) Try to fetch the repo. If it 404s, create it.
      let repoExists = false;
      const checkRes = await fetch(
        `https://api.github.com/repos/${owner.trim()}/${repo.trim()}`,
        { headers },
      );
      if (checkRes.ok) {
        repoExists = true;
      } else if (checkRes.status === 404) {
        setState("creating");
        setProgress(`Creating repository ${owner}/${repo}…`);
        const createBody: Record<string, unknown> = {
          name: repo.trim(),
          private: isPrivate,
          auto_init: true,
        };
        // For personal accounts, create at /user/repos. For orgs, the
        // user types the org name in `owner` and we use /orgs/{org}/repos.
        const isOrg = owner.trim().toLowerCase() !== (await whoAmI(headers));
        const createUrl = isOrg
          ? `https://api.github.com/orgs/${owner.trim()}/repos`
          : "https://api.github.com/user/repos";
        const createRes = await fetch(createUrl, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(createBody),
        });
        if (!createRes.ok) {
          const errBody = await createRes.json().catch(() => null);
          throw new Error(
            `Failed to create repo (${createRes.status}): ${errBody?.message || createRes.statusText}`,
          );
        }
        repoExists = true;
      } else {
        throw new Error(
          `GitHub check failed (${checkRes.status}). Verify your token and username.`,
        );
      }

      if (!repoExists) {
        throw new Error("Repository could not be located or created.");
      }

      // 2) Push each file via the Contents API.
      // First, download the zip to use as fallback / for the user to
      // grab locally if push fails partway.
      const zip = new JSZip();
      files.forEach((f) => zip.file(f.path, f.content));
      const blob = await zip.generateAsync({ type: "blob" });
      // Hold a downloadable URL in case the user wants it.
      const zipUrl = URL.createObjectURL(blob);

      setState("pushing");
      let pushed = 0;
      let failed: string[] = [];
      for (const file of files) {
        setProgress(`Pushing ${file.path} (${pushed + 1}/${files.length})…`);
        try {
          // Base64-encode the UTF-8 content. btoa() doesn't handle
          // non-ASCII, so we go via TextEncoder → base64.
          const encoded = base64EncodeUtf8(file.content);
          const res = await fetch(
            `https://api.github.com/repos/${owner.trim()}/${repo.trim()}/contents/${file.path}`,
            {
              method: "PUT",
              headers: { ...headers, "Content-Type": "application/json" },
              body: JSON.stringify({
                message: `feat: add ${file.path}`,
                content: encoded,
              }),
            },
          );
          if (!res.ok && res.status !== 422) {
            // 422 = file already exists with different content; try
            // updating with the existing SHA.
            const errBody = await res.json().catch(() => null);
            throw new Error(errBody?.message || `HTTP ${res.status}`);
          }
          if (res.status === 422) {
            // Fetch existing SHA and update.
            const existingRes = await fetch(
              `https://api.github.com/repos/${owner.trim()}/${repo.trim()}/contents/${file.path}`,
              { headers },
            );
            if (existingRes.ok) {
              const existing = await existingRes.json();
              const sha = existing?.sha;
              const updateRes = await fetch(
                `https://api.github.com/repos/${owner.trim()}/${repo.trim()}/contents/${file.path}`,
                {
                  method: "PUT",
                  headers: { ...headers, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    message: `chore: update ${file.path}`,
                    content: base64EncodeUtf8(file.content),
                    sha,
                  }),
                },
              );
              if (!updateRes.ok) {
                const errBody = await updateRes.json().catch(() => null);
                throw new Error(errBody?.message || `HTTP ${updateRes.status}`);
              }
            } else {
              throw new Error("Could not resolve existing file SHA for update.");
            }
          }
          pushed += 1;
        } catch (e) {
          failed.push(file.path);
        }
      }

      if (failed.length === 0) {
        setState("done");
        setProgress(`All ${pushed} files pushed successfully.`);
        URL.revokeObjectURL(zipUrl);
        toast({
          title: "Pushed to GitHub!",
          description: `${pushed} files → https://github.com/${owner}/${repo}`,
        });
      } else {
        setState("error");
        setError(
          `Pushed ${pushed}/${files.length} files. Failed: ${failed.slice(0, 5).join(", ")}${failed.length > 5 ? "…" : ""}`,
        );
      }
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "Push failed unexpectedly.");
    }
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogTitle>Push to GitHub</DialogTitle>
        <DialogDescription>
          Push the generated files to a new or existing GitHub repository.
          Your token is used only for this request and never stored.
        </DialogDescription>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">
              GitHub Personal Access Token (PAT)
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono"
              autoComplete="off"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Needs <code>repo</code> scope. Create one at{" "}
              <a
                href="https://github.com/settings/tokens/new?scopes=repo"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                github.com/settings/tokens
              </a>
              .
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Owner (user or org)
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="your-username"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">
                Repository name
              </label>
              <input
                type="text"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder={defaultRepoName}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                autoComplete="off"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="size-4"
            />
            Make repository private
          </label>
        </div>

        {progress && state !== "done" && (
          <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
            {progress}
          </div>
        )}
        {state === "done" && (
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
            {progress}{" "}
            <a
              href={`https://github.com/${owner}/${repo}`}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              Open repository →
            </a>
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePush}
            disabled={state === "creating" || state === "pushing"}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
          >
            {state === "creating"
              ? "Creating repo…"
              : state === "pushing"
                ? "Pushing…"
                : "Push to GitHub"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Fetch the authenticated user's login — used to detect if `owner` is
// the user themselves (personal repo) vs an org they're a member of.
async function whoAmI(headers: Record<string, string>): Promise<string> {
  try {
    const res = await fetch("https://api.github.com/user", { headers });
    if (!res.ok) return "";
    const data = await res.json();
    return (data?.login ?? "").toLowerCase();
  } catch {
    return "";
  }
}

// UTF-8 safe base64 encode (btoa chokes on non-Latin1 chars).
function base64EncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
