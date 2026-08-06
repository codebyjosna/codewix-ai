"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, FormEvent } from "react";
import { StatusDialog, useStatusDialog } from "@/components/ui/status-dialog";

export default function NewPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // L12: token is now optional in the URL — the httpOnly reset-token cookie
  // (set by /verify-otp) is the primary source. We still read the URL param
  // for backward compat with older email links.
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false);
  const { state, showSuccess, showError, close } = useStatusDialog();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (password !== confirmPassword) {
      showError("Passwords do not match");
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // If token is empty, the confirm route falls back to the cookie.
        body: JSON.stringify({ resetToken: token || undefined, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || "Something went wrong");
        return;
      }

      showSuccess("Password updated. Please sign in.", () => {
        router.push("/signin");
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <h1 className="mb-6 text-2xl font-bold">Set a new password</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset disabled={pending} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {pending ? "Saving..." : "Save new password"}
          </button>
        </fieldset>
      </form>

      <StatusDialog state={state} onClose={close} />
    </div>
  );
}
