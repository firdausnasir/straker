import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAccountsWithCards } from "@/lib/accounts";
import type { AccountType, CardNetwork } from "@/lib/constants";
import type { PaymentAccountDTO } from "@/lib/types";
import { AppHeader } from "@/components/app-header";
import { TabBar } from "@/components/tab-bar";
import { AccountsManager } from "@/components/accounts/accounts-manager";

export default async function AccountsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const accounts = await getAccountsWithCards(session.user.id);
  const dtos: PaymentAccountDTO[] = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type as AccountType,
    cards: a.cards.map((c) => ({
      id: c.id,
      label: c.label,
      last4: c.last4,
      network: c.network as CardNetwork | null,
    })),
  }));

  const cardCount = dtos.reduce((sum, a) => sum + a.cards.length, 0);

  return (
    // Shell offset: mobile clears the bottom nav bar; desktop clears the
    // left rail (width follows --rail-w, transitions on collapse).
    <div className="min-h-dvh pb-24 md:pb-16 md:pl-[var(--rail-w)] md:transition-[padding] md:duration-200 md:ease-[cubic-bezier(0.2,0,0,1)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <AppHeader
          title="Cards"
          subtitle={
            dtos.length === 0
              ? "Where your money goes out from"
              : `${dtos.length} ${dtos.length === 1 ? "account" : "accounts"} · ${cardCount} ${
                  cardCount === 1 ? "card" : "cards"
                }`
          }
        />

        <AccountsManager initialAccounts={dtos} />
      </div>

      <TabBar />
    </div>
  );
}
