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
    <div className="min-h-dvh pb-24 md:pb-16 md:pl-[var(--rail-w)] md:transition-[padding] md:duration-200 md:ease-[cubic-bezier(0.2,0,0,1)]">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        <AppHeader title="Settings" />
        <SettingsClient email={session.user.email ?? ""} />
      </div>
      <TabBar email={session.user.email ?? undefined} />
    </div>
  );
}
