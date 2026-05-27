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
      <AppHeader title="Analytics" subtitle={`${stats.total} active commitments`} />

      {stats.total === 0 ? (
        <div className="glass mt-6 rounded-[var(--radius-2xl)] px-6 py-16 text-center">
          <p className="text-lg font-bold text-foreground">Nothing to chart yet.</p>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Add commitments and your monthly outlook shows up here.
          </p>
        </div>
      ) : (
        <div className="mt-2 space-y-5">
          {/* Per-currency monthly outlook — currencies never mixed (no FX) */}
          <section className="space-y-2.5">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              Monthly outlook
            </h2>
            {stats.byCurrency.map((row, i) => (
              <div
                key={row.currency}
                className="glass animate-rise flex items-center justify-between rounded-[var(--radius-2xl)] px-5 py-4"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div>
                  <p className="text-[13px] font-medium text-muted-foreground">
                    {row.currency} · {row.count} {row.count === 1 ? "item" : "items"}
                  </p>
                  <p className="tnum mt-0.5 text-2xl font-bold text-foreground">
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
              Estimates normalise every cycle to a monthly figure. Weekly items use
              52 weeks ÷ 12 months.
            </p>
          </section>

          {/* Breakdown by type */}
          <section className="space-y-2.5">
            <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
              By type
            </h2>
            <div className="glass divide-y divide-[var(--hairline)] rounded-[var(--radius-2xl)] px-5">
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
