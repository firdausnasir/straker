import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveCommitments } from "@/lib/commitments";
import { computeAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import type { CommitmentType, Currency } from "@/lib/constants";
import { AppHeader } from "@/components/app-header";
import { TabBar } from "@/components/tab-bar";
import { RunningTotal } from "@/components/running-total";
import { TypeBarChart } from "@/components/analytics/type-bar-chart";
import { AccountShareDonut } from "@/components/analytics/account-share-donut";

export default async function AnalyticsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const commitments = await getActiveCommitments(session.user.id);
  const stats = computeAnalytics(
    commitments.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type as CommitmentType,
      amountMinor: c.amountMinor,
      currency: c.currency as Currency,
      cycle: c.cycle as never,
      nextDueDate: c.nextDueDate.toISOString(),
      renewalMode: c.renewalMode as never,
      notes: c.notes,
      reminderEnabled: c.reminderEnabled,
      reminderLeadDays: c.reminderLeadDays,
      accountId: c.account?.id ?? null,
      account: c.account
        ? {
            id: c.account.id,
            name: c.account.name,
            last4: c.account.last4,
          }
        : null,
    })),
  );

  return (
    <div className="min-h-dvh pb-24 md:pb-16 md:pl-[var(--rail-w)] md:transition-[padding] md:duration-200 md:ease-[cubic-bezier(0.2,0,0,1)]">
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <AppHeader
          title="Analytics"
          subtitle={`${stats.total} active ${stats.total === 1 ? "commitment" : "commitments"}`}
        />

        {stats.total === 0 ? (
          <div className="surface animate-reveal mt-6 px-6 py-20 text-center">
            <p className="font-display text-balance text-2xl text-foreground">
              Nothing to chart yet.
            </p>
            <p className="text-pretty mx-auto mt-2 max-w-xs text-[14px] text-muted-foreground">
              Add commitments and your monthly outlook lands here as balance
              cards and charts, currency by currency.
            </p>
          </div>
        ) : (
          <div className="mt-2 space-y-10">
            {/* Per-currency monthly outlook — hero balance stat cards. Currencies
                are never mixed (no FX): each card is exact in its own currency.
                The running total is the hero figure, set in mono numerals. */}
            <section>
              <div className="flex min-h-[56px] items-center justify-between">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Monthly outlook
                </h2>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {stats.byCurrency.map((row, i) => {
                  // The largest-spend currency gets the accent gradient hero
                  // treatment; the rest are filled cards. Honest per-currency
                  // segregation either way (byCurrency is sorted desc upstream).
                  const isHero = i === 0;

                  return (
                    <div
                      key={row.currency}
                      className={`animate-reveal relative overflow-hidden rounded-2xl border p-5 ${
                        isHero
                          ? "border-transparent text-white shadow-[var(--shadow-card-raised)]"
                          : "surface"
                      }`}
                      style={
                        isHero
                          ? { background: "var(--gradient-accent)", animationDelay: `${i * 60}ms` }
                          : { animationDelay: `${i * 60}ms` }
                      }
                    >
                      <div className="flex items-center justify-between">
                        <p
                          className={`tnum text-[11px] font-semibold uppercase tracking-[0.1em] ${
                            isHero ? "text-white/80" : "text-muted-foreground"
                          }`}
                        >
                          {row.currency}
                        </p>
                        <p
                          className={`tnum text-[11px] font-medium ${
                            isHero ? "text-white/75" : "text-muted-foreground"
                          }`}
                        >
                          {row.count} {row.count === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <RunningTotal
                        value={formatMoney(row.perMonthMinor, row.currency)}
                        prefix="≈"
                        className={`mt-3 block text-[2.25rem] leading-none ${
                          isHero ? "text-white" : "text-foreground"
                        }`}
                      />
                      <p
                        className={`mt-2 text-[12px] ${
                          isHero ? "text-white/80" : "text-muted-foreground"
                        }`}
                      >
                        per month
                      </p>
                      <p
                        className={`mt-4 border-t pt-3 text-[13px] ${
                          isHero ? "border-white/20 text-white/85" : "border-border text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`tnum font-num font-semibold ${isHero ? "text-white" : "text-foreground"}`}
                        >
                          ≈ {formatMoney(row.perYearMinor, row.currency)}
                        </span>{" "}
                        per year
                      </p>
                    </div>
                  );
                })}
              </div>
              <p className="text-pretty mt-3 px-1 text-[12px] text-muted-foreground">
                Estimates normalise every cycle to a monthly figure. Weekly items
                use 52 weeks ÷ 12 months.
              </p>
            </section>

            {/* Breakdown by type — bar chart of magnitude over counts. */}
            <section>
              <div className="flex min-h-[56px] items-center justify-between">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  By type
                </h2>
              </div>
              <TypeBarChart data={stats.byType} />
            </section>

            {/* By account — share-of-spend donut within one currency, plus the
                numeric per-currency rows as the accessible table-equivalent.
                Currencies are never mixed (no FX). */}
            <section>
              <div className="flex min-h-[56px] items-center justify-between">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  By account
                </h2>
              </div>
              <AccountShareDonut data={stats.byAccount} />
              <div className="surface mt-3 px-5">
                {stats.byAccount.map((account, i) => (
                  <div
                    key={account.accountId}
                    className="animate-reveal border-b border-border py-4 last:border-b-0"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-medium text-foreground">
                        {account.accountName}
                      </span>
                      <span className="tnum text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                        {account.count} {account.count === 1 ? "item" : "items"}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {account.byCurrency.map((row) => (
                        <div
                          key={row.currency}
                          className="flex items-baseline justify-between"
                        >
                          <span className="tnum text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                            {row.currency}
                          </span>
                          <span className="tnum text-[15px] font-semibold text-foreground">
                            ≈ {formatMoney(row.perMonthMinor, row.currency)}
                            <span className="ml-1 text-[12px] font-normal text-muted-foreground">
                              / mo
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <TabBar email={session.user.email ?? undefined} />
    </div>
  );
}
