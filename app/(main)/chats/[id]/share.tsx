"use client";

import ShareIcon from "@/components/icons/share-icon";
import { toast } from "@/hooks/use-toast";
import { Message } from "@prisma/client";

export function Share({ message }: { message?: Message }) {
  async function shareAction() {
    if (!message) return;

    const baseUrl = window.location.href;
    const shareUrl = new URL(`/share/v2/${message.id}`, baseUrl);

    // M11: write to clipboard FIRST, then toast on success — avoids false
    // "copied" success when the clipboard API rejects (non-secure context,
    // permissions policy).
    try {
      await navigator.clipboard.writeText(shareUrl.href);
      toast({
        title: "App Published!",
        description: `App URL copied to clipboard: ${shareUrl.href}`,
        variant: "default",
      });
    } catch {
      toast({
        title: "Share link ready",
        description: `Could not copy automatically. Copy manually: ${shareUrl.href}`,
        variant: "destructive",
      });
    }
  }

  return (
    <form action={shareAction} className="flex">
      <button
        type="submit"
        disabled={!message}
        className="inline-flex items-center gap-1 rounded border border-gray-300 px-1.5 py-0.5 text-sm text-gray-600 enabled:hover:bg-white disabled:opacity-50"
      >
        <ShareIcon className="size-3" />
        Share
      </button>
    </form>
  );
}
