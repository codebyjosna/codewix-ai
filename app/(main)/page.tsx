import { redirect } from "next/navigation";
import HomeClient from "./home-client";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  // Signed-in users always live at /<uuid>; keep "/" as the guest landing page.
  if (user) {
    redirect(`/${user.id}`);
  }

  return <HomeClient initialUser={null} />;
}

// Note: this page now reads the session via Prisma (getCurrentUser), which
// needs Node's TCP driver and can't run on the Edge runtime.
export const maxDuration = 60;
