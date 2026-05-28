import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveCommitments } from "@/lib/commitments";
import { computeAnalytics } from "@/lib/analytics";
import { formatMoney } from "@/lib/money";
import { TYPE_LABELS, type CommitmentType, type Currency } from "@/lib/constants";
import { AppHeader } from "@/components/app-header";
import { TabBar } from "@/components/tab-bar";

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
    })),
  );

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4 pb-32 sm:px-6">
      <AppHeader
        title="Analytics"
        subtitle={`${stats.total} active ${stats.total === 1 ? "commitment" : "commitments"}`}
      />

      {stats.total === 0 ? (
        <div className="surface mt-6 px-6 py-16 text-center">
          <p className="text-2xl font-semibold text-foreground">Nothing to chart yet.</p>
          <p className="mt-2 text-[14px] text-muted-foreground">
            Add commitments and your monthly outlook shows up here.
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-6">
          {/* Per-currency monthly outlook — currencies never mixed (no FX) */}
          <section className="space-y-2.5">
            <h2 className="px-1 text-[13px] font-medium text-muted-foreground">
              Monthly outlook
            </h2>
            {stats.byCurrency.map((row, i) => (
              <div
                key={row.currency}
                className="surface animate-rise flex items-end justify-between px-5 py-5"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div>
                  <p className="text-[13px] font-medium text-muted-foreground">
                    {row.currency} · {row.count} {row.count === 1 ? "item" : "items"}
                  </p>
                  <p className="tnum mt-1 text-3xl font-bold text-foreground">
                    ≈ {formatMoney(row.perMonthMinor, row.currency)}
                  </p>
                  <p className="text-[12px] text-muted-foreground">per month</p>
                </div>
                <div className="text-right">
                  <p className="tnum text-[15px] font-semibold text-foreground">
                    ≈ {formatMoney(row.perYearMinor, row.currency)}
                  </p>
                  <p className="text-[12px] text-muted-foreground">per year</p>
                </div>
              </div>
            ))}
            <p className="px-1 text-[12px] text-muted-foreground">
              Estimates normalise every cycle to a monthly figure. Weekly items
              use 52 weeks ÷ 12 months.
            </p>
          </section>

          {/* Breakdown by type */}
          <section className="space-y-2.5">
            <h2 className="px-1 text-[13px] font-medium text-muted-foreground">
              By type
            </h2>
            <div className="surface divide-y divide-[var(--hairline)] px-5">
              {stats.byType.map((row) => (
                <div key={row.type} className="flex items-center justify-between py-3.5">
                  <span className="text-[15px] font-medium text-foreground">
                    {TYPE_LABELS[row.type as CommitmentType] ?? row.type}
                  </span>
                  <span className="tnum text-[15px] font-semibold text-muted-foreground">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <TabBar />
    </div>
  );
}
