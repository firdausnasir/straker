"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import {
  Wallet,
  ChartColumnBig,
  CreditCard,
  Settings,
  Loader2,
  PanelLeftClose,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Subs", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: ChartColumnBig },
  { href: "/accounts", label: "Cards", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

// Flip the collapsed state on <html>. Width + label visibility are CSS-driven
// off [data-rail] (set pre-paint in layout.tsx), so there's no hydration flash
// and content offset (md:pl-[var(--rail-w)]) stays in lockstep with the rail.
function toggleRail() {
  const el = document.documentElement;
  const next = el.dataset.rail === "collapsed" ? "expanded" : "collapsed";
  el.dataset.rail = next;
  try {
    localStorage.setItem("rail", next);
  } catch {}
}

// Modern-fintech nav. One responsive element that overlays page content:
//   - mobile (<md): bottom dock (fixed, safe-area aware), active = cobalt icon +
//     a soft cobalt pill behind it + a top tick.
//   - desktop (md+): collapsible left rail sized by --rail-w (240 ↔ 72px),
//     wordmark links home, cobalt-tinted active row + left-edge marker. Depth is a
//     filled card surface lifting on a subtle elevation, not just a hairline.
export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "fixed z-30 bg-card shadow-[var(--shadow-card)]",
        // mobile: full-width bottom dock, hairline top rule, safe-area padding
        "inset-x-0 bottom-0 flex items-stretch border-t border-border pb-[env(safe-area-inset-bottom)]",
        // desktop: left rail, width follows --rail-w, FULL height (inset-y-0 anchors
        // top+bottom), hairline right rule. Mobile's bottom-0 + border-t are reset.
        "md:inset-y-0 md:left-0 md:right-auto md:w-[var(--rail-w)] md:flex-col md:items-stretch md:border-t-0 md:border-r md:px-3 md:py-4",
        "md:transition-[width] md:duration-200 md:ease-[cubic-bezier(0.2,0,0,1)]",
      )}
    >
      {/* Rail head — brand mark + wordmark link home; collapse toggle. Desktop
          only. When collapsed the wordmark group hides and only the toggle
          remains (centered via .rail-head). */}
      <div className="rail-head mb-2 hidden items-center justify-between gap-1 border-b border-border px-1 pb-4 md:flex">
        <Link
          href="/"
          aria-label="Straker — home"
          className="rail-wordmark-full flex min-w-0 items-center gap-2.5 rounded-lg px-1 py-1 text-foreground transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {/* gradient brand chip — mirrors the login mark */}
          <span
            aria-hidden
            className="grid size-8 shrink-0 place-items-center rounded-lg bg-[image:var(--gradient-accent)] text-white shadow-[var(--shadow-card)]"
          >
            <Wallet className="size-[18px]" strokeWidth={2.2} />
          </span>
          <span className="truncate text-lg font-display tracking-tight">Straker</span>
        </Link>
        <button
          type="button"
          onClick={toggleRail}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <PanelLeftClose className="size-[18px]" strokeWidth={2} />
        </button>
      </div>

      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            title={label}
            className={cn(
              "rail-row relative flex items-center justify-center transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:rounded-lg md:focus-visible:ring-inset",
              // mobile segment: equal-width, stacked, ≥44px tap target
              "min-h-[52px] flex-1 flex-col gap-0.5 text-[11px] font-medium",
              // desktop row: icon + label inline, left-aligned, ≥44px tall
              "md:min-h-[44px] md:flex-initial md:flex-row md:justify-start md:gap-3 md:px-3 md:py-2.5 md:text-sm md:font-medium",
              // active: cobalt — a single clean filled pill on desktop (no marker),
              // a top tick on the mobile dock.
              active
                ? "text-primary md:bg-primary/10 md:font-semibold"
                : "text-muted-foreground hover:text-foreground md:hover:bg-accent",
            )}
          >
            {active && (
              /* mobile: cobalt tick along the top edge of the active segment */
              <span
                aria-hidden
                className="absolute inset-x-5 top-0 h-[3px] rounded-full bg-primary md:hidden"
              />
            )}
            <TabContent icon={Icon} label={label} />
          </Link>
        );
      })}
    </nav>
  );
}

// Swaps the icon for a spinner while this link's navigation is in flight, so the
// tapped item signals the next page is loading. The label carries a `rail-label`
// class so the collapsed desktop rail hides it (CSS, mobile keeps it).
function TabContent({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  const { pending } = useLinkStatus();

  return (
    <>
      {pending ? (
        <Loader2 className="h-5 w-5 shrink-0 animate-spin" strokeWidth={2} />
      ) : (
        <Icon className="h-5 w-5 shrink-0" strokeWidth={2} />
      )}
      <span className="rail-label">{label}</span>
    </>
  );
}
