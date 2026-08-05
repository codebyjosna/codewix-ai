import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// Always re-check the session cookie; never let a CDN/browser cache a stale
// signed-out (or signed-in) response.
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  const body = user ? { user: { id: user.id, name: user.name } } : { user: null };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store, max-age=0, must-revalidate" },
  });
}
