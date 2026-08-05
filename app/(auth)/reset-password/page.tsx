"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";
import ArrowLeftIcon from "@/components/icons/arrow-left";
import { StatusDialog, useStatusDialog } from "@/components/ui/status-dialog";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const { state, showSuccess, close } = useStatusDialog();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);

    try {
      await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      // Always proceed to the OTP screen, whether or not the email exists,
      // to avoid revealing account existence.
      showSuccess("If that email exists, a code has been sent.", () => {
        router.push(
          `/verify-otp?email=${encodeURIComponent(email)}&purpose=reset`,
        );
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <Link
        href="/signin"
        className="mb-6 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeftIcon />
        Back
      </Link>

      <h1 className="mb-2 text-2xl font-bold">Reset your password</h1>
      <p className="mb-6 text-sm text-gray-500">
        We&apos;ll email you a 6-digit code to reset your password.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <fieldset disabled={pending} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
          >
            {pending ? "Sending..." : "Send code"}
          </button>
        </fieldset>
      </form>

      <StatusDialog state={state} onClose={close} />
    </div>
  );
}
