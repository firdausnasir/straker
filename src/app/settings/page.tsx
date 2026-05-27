import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { TabBar } from "@/components/tab-bar";
import { SettingsClient } from "@/components/settings-client";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-32 sm:px-6">
      <AppHeader title="Settings" />
      <SettingsClient email={session.user.email ?? ""} />
      <TabBar />
    </div>
  );
}
