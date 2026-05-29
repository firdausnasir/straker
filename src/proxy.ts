import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js Proxy (formerly Middleware), powered by Auth.js. The edge-safe
// `authConfig.authorized` callback decides which routes require a session and
// redirects unauthenticated visitors to /login.
const { auth } = NextAuth(authConfig);

export { auth as proxy };

export const config = {
  // Run on pages only — skip Auth.js's own endpoints, Next internals, static
  // assets, and the PWA files (sw.js + manifest). The service worker script in
  // particular must NOT be redirected — browsers reject a redirected SW.
  // API routes enforce auth themselves via `auth()`.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
