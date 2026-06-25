"use client";

import { useEffect, useRef, useState } from "react";

// Signature interaction — the running total. Presentation-only: it receives an
// already-formatted money string (computed upstream via formatMoney) and never
// touches money math itself. On mount it reveals; when the formatted value
// changes it re-tallies with a per-character digit-roll (animate-digit keyframe
// from globals.css), staggered left→right. Reduced-motion users get a plain
// cross-fade — the CSS already disables the keyframe under prefers-reduced-motion,
// so the staggered fade reads as a calm cross-fade instead of a roll.
export function RunningTotal({
  value,
  prefix,
  className = "",
}: {
  value: string;
  prefix?: string;
  className?: string;
}) {
  // `epoch` bumps on every value change so React remounts the character spans,
  // restarting the one-shot animation. The first paint is the mount reveal.
  const [epoch, setEpoch] = useState(0);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setEpoch((e) => e + 1);
    }
  }, [value]);

  const chars = [...value];

  return (
    <span
      className={`font-num tnum tabular-nums ${className}`}
      aria-label={prefix ? `${prefix} ${value}` : value}
    >
      {prefix && (
        <span aria-hidden className="mr-1 text-muted-foreground">
          {prefix}
        </span>
      )}
      {/* aria-hidden so screen readers read the stable aria-label, not the
          per-character spans. */}
      <span aria-hidden className="inline-flex">
        {chars.map((ch, i) => (
          <span
            key={`${epoch}-${i}`}
            className="animate-digit inline-block"
            style={{ animationDelay: `${i * 28}ms` }}
          >
            {ch === " " ? " " : ch}
          </span>
        ))}
      </span>
    </span>
  );
}
