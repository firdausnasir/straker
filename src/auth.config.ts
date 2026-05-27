import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config: no Prisma, no bcrypt, no Node APIs. Shared by the
// proxy (middleware) for optimistic route protection and extended in auth.ts
// with the Credentials provider. The `authorized` callback is the single
// source of truth for which routes require a session.
export const authConfig = {
  // Self-hosted: trust the deploying host (otherwise Auth.js rejects requests
  // in production with UntrustedHost). Override per-env with AUTH_TRUST_HOST.
  trustHost: true,
  pages: { signIn: "/login" },
  // Providers added in auth.ts; the proxy only needs the callbacks below.
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const loggedIn = Boolean(auth?.user);
      const { pathname } = request.nextUrl;

      // The login page is always reachable (so an orphaned session can recover).
      if (pathname === "/login") {
        return true;
      }

      // Everything else this proxy matches requires a session. Returning false
      // makes Auth.js redirect to `pages.signIn`.
      return loggedIn;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }

      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }

      return session;
    },
  },
} satisfies NextAuthConfig;
