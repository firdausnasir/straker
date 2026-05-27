import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js Proxy (formerly Middleware), powered by Auth.js. The edge-safe
// `authConfig.authorized` callback decides which routes require a session and
// redirects unauthenticated visitors to /login.
const { auth } = NextAuth(authConfig);

export { auth as proxy };

export const config = {
  // Run on pages only — skip Auth.js's own endpoints, Next internals, and
  // static assets. API routes enforce auth themselves via `auth()`.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico)$).*)",
  ],
};
