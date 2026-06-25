"use client";

import { signOut } from "next-auth/react";
import { Monitor, Sun, Moon, LogOut, Palette } from "lucide-react";
import { useTheme, type ThemePref } from "./theme";
import { NotificationsSettings } from "./pwa/notifications-settings";
import { PasskeySettings } from "./passkey-settings";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Monitor }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function SettingsClient({ email }: { email: string }) {
  const { pref, setPref } = useTheme();

  function handleLogout() {
    void signOut({ redirectTo: "/login" });
  }

  const initial = (email[0] ?? "?").toUpperCase();

  return (
    <div className="mt-3 space-y-8">
      {/* Identity leads — who you are, with the same gradient initial chip the
          desktop rail footer uses, so the two read as one account surface. */}
      <section className="space-y-3">
        <h2 className="font-display px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Account
        </h2>
        <div className="surface flex items-center gap-3 px-5 py-5 animate-reveal" style={{ animationDelay: "60ms" }}>
          <span
            aria-hidden
            className="grid size-11 shrink-0 place-items-center rounded-xl bg-[image:var(--gradient-accent)] text-base font-semibold text-white shadow-[var(--shadow-card)]"
          >
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] text-muted-foreground">Signed in as</span>
            <span className="mt-0.5 block truncate text-[15px] font-semibold text-foreground">{email}</span>
          </span>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Appearance
        </h2>
        <div className="surface px-5 py-5 animate-reveal" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <Palette className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-foreground">Theme</span>
              <span className="block text-[13px] text-muted-foreground text-pretty">
                System follows your device automatically
              </span>
            </span>
          </div>

          {/* segmented control: System / Light / Dark — inset track, softly
              elevated cobalt active pill. */}
          <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
            {OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = pref === value;

              return (
                <button
                  key={value}
                  onClick={() => setPref(value)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-1.5 rounded-lg py-2 text-[13px] font-medium transition-[color,background-color,box-shadow] duration-[140ms] [transition-timing-function:cubic-bezier(0.2,0,0,1)] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    active
                      ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <NotificationsSettings />

      <PasskeySettings />

      {/* Destructive action trails — spatially separated from identity, last in
          the page so it's never the first thing a thumb lands on. */}
      <Button
        variant="destructive"
        onClick={handleLogout}
        className="h-12 w-full justify-center gap-2 rounded-xl text-[15px] font-semibold active:scale-[0.96]"
      >
        <LogOut className="h-[18px] w-[18px]" />
        Sign out
      </Button>
    </div>
  );
}
