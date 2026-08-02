import { Suspense } from "react";
import VerifyOtpForm from "./verify-otp-form";
import { Skeleton } from "@/components/ui/skeleton";

function VerifyOtpSkeleton() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <Skeleton className="mb-6 h-4 w-16" />
      <Skeleton className="mb-2 h-7 w-48" />
      <Skeleton className="mb-6 h-4 w-64" />

      <div className="flex justify-between gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-12 rounded-lg" />
        ))}
      </div>

      <Skeleton className="mt-4 h-10 w-full rounded-lg" />
      <Skeleton className="mx-auto mt-6 h-4 w-40" />
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<VerifyOtpSkeleton />}>
      <VerifyOtpForm />
    </Suspense>
  );
}
