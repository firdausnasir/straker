import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Straker — Commitment Tracker",
  description: "Track subscriptions, recurring bills, and loans in MYR and USD.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#e9eaef" },
    { media: "(prefers-color-scheme: dark)", color: "#06070a" },
  ],
};

// Set the theme class before first paint (no flash), and keep following the OS
// live whenever the preference is "system" (the default).
const themeScript = `
(function () {
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    function apply() {
      var p = localStorage.getItem('theme') || 'system';
      var dark = p === 'dark' || (p === 'system' && mq.matches);
      document.documentElement.classList.toggle('dark', dark);
    }
    apply();
    mq.addEventListener('change', apply);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="relative min-h-full">
        <div className="relative z-10">{children}</div>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
