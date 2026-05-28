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
      className={`grid h-11 w-11 place-items-center rounded-full bg-card text-foreground transition-transform active:scale-95 ${className ?? ""}`}
      style={{ boxShadow: "var(--shadow-soft)" }}
    >
      {resolved === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
