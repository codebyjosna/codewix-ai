import HomeClient from "./home-client";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  return (
    <HomeClient initialUser={user ? { id: user.id, name: user.name } : null} />
  );
}

// Note: this page now reads the session via Prisma (getCurrentUser), which
// needs Node's TCP driver and can't run on the Edge runtime.
export const maxDuration = 60;
