"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ThemePref = "system" | "light" | "dark";
type Resolved = "light" | "dark";

// The effective theme lives in the DOM (a `.dark` class on <html>, kept in sync
// by the inline script in layout — including live OS changes when the pref is
// "system"). The preference itself lives in localStorage. Both are external
// state, read here via useSyncExternalStore (SSR-safe, no setState-in-effect).

function getPref(): ThemePref {
  try {
    const v = localStorage.getItem("theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // storage blocked — fall through to default
  }

  return "system";
}

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolve(pref: ThemePref): Resolved {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";

  return pref;
}

function applyPref(pref: ThemePref): void {
  document.documentElement.classList.toggle("dark", resolve(pref) === "dark");
}

// One subscribe covers everything: <html> class mutations (resolved theme) and
// preference changes (custom event + cross-tab storage event).
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("themechange", onChange);
  window.addEventListener("storage", onChange);

  return () => {
    observer.disconnect();
    window.removeEventListener("themechange", onChange);
    window.removeEventListener("storage", onChange);
  };
}

const getResolvedSnapshot = (): Resolved =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export function useTheme() {
  const pref = useSyncExternalStore(subscribe, getPref, () => "system" as ThemePref);
  const resolved = useSyncExternalStore(subscribe, getResolvedSnapshot, () => "light" as Resolved);

  const setPref = useCallback((next: ThemePref) => {
    try {
      localStorage.setItem("theme", next);
    } catch {
      // storage blocked — theme still applies for the session
    }

    applyPref(next);
    window.dispatchEvent(new Event("themechange"));
  }, []);

  // Quick light/dark flip (top-bar / login). Sets an explicit preference.
  const toggle = useCallback(() => {
    setPref(getResolvedSnapshot() === "dark" ? "light" : "dark");
  }, [setPref]);

  return { pref, resolved, setPref, toggle };
}
