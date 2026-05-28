"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, ChartColumnBig, Settings, Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Subs", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: ChartColumnBig },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    // Floating parchment pill at the bottom. Soft warm shadow lifts it off the
    // sand bg. Full-width on mobile (within page padding), content-width on
    // desktop.
    <nav className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
      <div
        className="flex w-full items-stretch gap-1 rounded-full bg-card p-1.5 sm:w-fit"
        style={{ boxShadow: "var(--shadow-float)" }}
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-4 text-[11px] font-medium transition-colors sm:flex-initial sm:min-w-[84px]",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-primary"
                  style={{ boxShadow: "var(--shadow-cta)" }}
                />
              )}
              <TabContent icon={Icon} label={label} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// Swaps the icon for a spinner while this link's navigation is in flight, so the
// tapped tab signals that the next page is loading. `useLinkStatus` reads the
// pending state of the enclosing <Link>.
function TabContent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      {pending ? (
        <Loader2 className="relative h-[20px] w-[20px] animate-spin" strokeWidth={2} />
      ) : (
        <Icon className="relative h-[20px] w-[20px]" strokeWidth={2} />
      )}
      <span className="relative">{label}</span>
    </>
  );
}
