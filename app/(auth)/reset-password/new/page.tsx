import { Suspense } from "react";
import NewPasswordForm from "./new-password-form";
import { Skeleton } from "@/components/ui/skeleton";

function NewPasswordSkeleton() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
      <Skeleton className="mb-6 h-7 w-56" />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="mt-2 h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

export default function NewPasswordPage() {
  return (
    <Suspense fallback={<NewPasswordSkeleton />}>
      <NewPasswordForm />
    </Suspense>
  );
}
