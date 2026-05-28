import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

// Body sans — Inter with tabular nums enabled per use site via `.tnum`.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Display serif — Fraunces. Light weights only; used for page titles.
// `opsz` axis lets the renderer pick the optical size for the rendered px.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["opsz"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Straker — Commitment Tracker",
  description: "Track subscriptions, recurring bills, and loans in MYR and USD.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1612" },
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
    <html
      lang="en"
      className={`h-full ${inter.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
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
