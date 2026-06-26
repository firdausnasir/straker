import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccounts, getDefaultAccount } from "@/lib/accounts";
import type { PaymentAccountDTO } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { TabBar } from "@/components/tab-bar";
import { AccountsManager } from "@/components/accounts/accounts-manager";

export default async function AccountsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const accounts = await getAccounts(session.user.id);
  const defaultAccount = await getDefaultAccount(session.user.id);
  const dtos: PaymentAccountDTO[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    last4: a.last4,
  }));

  return (
    // Shell offset: mobile clears the bottom nav bar; desktop clears the
    // left rail (width follows --rail-w, transitions on collapse).
    <div className="min-h-dvh pb-24 md:pb-16 md:pl-[var(--rail-w)] md:transition-[padding] md:duration-200 md:ease-[cubic-bezier(0.2,0,0,1)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <AppHeader
          title="Accounts"
          subtitle={
            dtos.length === 0
              ? "Where your money goes out from"
              : `${dtos.length} ${dtos.length === 1 ? "account" : "accounts"}`
          }
        />

        <AccountsManager
          initialAccounts={dtos}
          defaultAccountId={defaultAccount?.id ?? null}
        />
      </div>

      <TabBar email={session.user.email ?? undefined} />
    </div>
  );
}
