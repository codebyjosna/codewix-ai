import { redirect } from "next/navigation";
import HomeClient from "../home-client";
import { getCurrentUser } from "@/lib/auth";

// The signed-in homepage: same builder UI as "/", but at a personalized URL.
export default async function UserHome({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();

  if (!user || user.id !== id) {
    redirect("/");
  }

  return <HomeClient initialUser={{ id: user.id, name: user.name }} />;
}

export const maxDuration = 60;
