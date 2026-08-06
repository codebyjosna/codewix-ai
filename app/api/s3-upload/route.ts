// app/api/s3-upload/route.ts
// Wrap the next-s3-upload handler with authentication so only signed-in
// users can request presigned S3 upload URLs.
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth";

// Re-export the upstream POST, but gate it behind an auth check.
async function authenticatedPOST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in required to upload files" },
      { status: 401 },
    );
  }
  // Dynamically import so the upstream module only loads when needed.
  const upstream = await import("next-s3-upload/route");
  if (typeof upstream.POST === "function") {
    return upstream.POST(req);
  }
  return NextResponse.json(
    { error: "Upload handler unavailable" },
    { status: 500 },
  );
}

export { authenticatedPOST as POST };
