"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme";

// Shared sticky glass header: theme toggle (left), centered title, balanced
// right slot. Used by Analytics and Settings; Subs has its own (add/sort).
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { resolved, toggle } = useTheme();

  return (
    <header className="animate-rise sticky top-0 z-20 flex items-center justify-between gap-3 py-4">
      <button
        onClick={toggle}
        aria-label="Toggle theme"
        className="glass grid h-11 w-11 place-items-center rounded-full text-foreground transition-transform active:scale-95"
      >
        {resolved === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>

      <div className="text-center">
        <h1 className="text-[19px] font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle && <p className="text-[11px] font-medium text-muted-foreground">{subtitle}</p>}
      </div>

      {/* spacer to keep the title optically centred */}
      <span aria-hidden className="h-11 w-11" />
    </header>
  );
}
