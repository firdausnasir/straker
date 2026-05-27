"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "./theme";

// Standalone circular glass theme toggle (used on the login screen, which has
// no app header). Inner pages toggle theme from their own headers.
export function ThemeButton({ className }: { className?: string }) {
  const { resolved, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className={`glass grid h-11 w-11 place-items-center rounded-full text-foreground transition-transform active:scale-95 ${className ?? ""}`}
    >
      {resolved === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  );
}
