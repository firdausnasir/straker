"use client";

import { signOut } from "next-auth/react";
import { Monitor, Sun, Moon, LogOut, Palette } from "lucide-react";
import { useTheme, type ThemePref } from "./theme";
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

  return (
    <div className="mt-2 space-y-5">
      <section className="space-y-2.5">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Appearance
        </h2>
        <div className="glass rounded-[var(--radius-2xl)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--brand-tint)] text-primary">
              <Palette className="h-[18px] w-[18px]" />
            </span>
            <span>
              <span className="block text-[15px] font-semibold text-foreground">Theme</span>
              <span className="block text-[13px] text-muted-foreground">
                System follows your device automatically
              </span>
            </span>
          </div>

          {/* segmented control: System / Light / Dark */}
          <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl bg-[var(--secondary)] p-1">
            {OPTIONS.map(({ value, label, icon: Icon }) => {
              const active = pref === value;

              return (
                <button
                  key={value}
                  onClick={() => setPref(value)}
                  aria-pressed={active}
                  className={cn(
                    "flex min-h-11 items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-medium transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-[0_6px_18px_-8px_var(--brand)]"
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

      <section className="space-y-2.5">
        <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
          Account
        </h2>
        <div className="glass rounded-[var(--radius-2xl)] px-5 py-4">
          <p className="text-[13px] text-muted-foreground">Signed in as</p>
          <p className="mt-0.5 truncate text-[15px] font-semibold text-foreground">{email}</p>
        </div>
        <Button
          variant="secondary"
          onClick={handleLogout}
          className="h-12 w-full justify-center gap-2 rounded-[var(--radius-2xl)] text-[15px] font-semibold text-[var(--danger)]"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign out
        </Button>
      </section>
    </div>
  );
}
