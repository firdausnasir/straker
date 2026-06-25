"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme";

// Standalone floating theme toggle (used on the login screen, which has no
// app header). Inner pages toggle theme from Settings.
export function ThemeButton({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-foreground shadow-[var(--shadow-card)] transition-[scale,background-color] duration-150 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] ${className ?? ""}`}
    >
      {resolved === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
