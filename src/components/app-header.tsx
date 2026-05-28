// Shared header for Analytics + Settings. In-flow (not sticky) so the page
// reads as one continuous surface — matches the floating-card aesthetic.
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="animate-rise mb-3 pt-6">
      <h1 className="font-display text-3xl text-foreground">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
      )}
    </header>
  );
}
