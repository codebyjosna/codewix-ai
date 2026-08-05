"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-gray-100 px-4">
      <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-center">
        <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
        <p className="mt-1 text-sm text-red-600">
          {error.message || "An unexpected error occurred."}
        </p>
      </div>
      <button
        onClick={() => reset()}
        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Try again
      </button>
    </div>
  );
}
