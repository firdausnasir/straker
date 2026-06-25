// Shared page header for Analytics + Settings. In-flow (the shell already
// offsets page content) — modern-fintech styling: confident display-weight
// title (IBM Plex Sans, tight tracking), muted subtitle, balanced wrap.
export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="animate-reveal mb-6 pt-8">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground text-balance font-display md:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="mt-2 text-sm text-muted-foreground text-pretty">{subtitle}</p>
      )}
    </header>
  );
}
