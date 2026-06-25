import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";

// System face — IBM Plex Sans. Carries both body and headings (hierarchy via
// weight). Data-grade, trustworthy. Tabular nums enabled per use site via `.tnum`.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Hero numerals — IBM Plex Mono. The running total + big balance figures
// (`.font-num`). Mono keeps money columns aligned — a precise-ledger feel.
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono-face",
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Straker — Commitment Tracker",
  description: "Track subscriptions, recurring bills, and loans in MYR and USD.",
  // Installable PWA: enable iOS standalone mode + supply the touch icon.
  appleWebApp: {
    capable: true,
    title: "Straker",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
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
    // Sidebar collapse — applied pre-paint so the rail width + content offset
    // (both read --rail-w) never flash on load.
    document.documentElement.dataset.rail =
      localStorage.getItem('rail') === 'collapsed' ? 'collapsed' : 'expanded';
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`h-full ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="relative min-h-full">
        <div className="relative z-10">{children}</div>
        <ServiceWorkerRegister />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
