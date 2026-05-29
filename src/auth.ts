import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { credentialsSchema } from "@/lib/validation";
import { verifyPasskeyToken } from "@/lib/passkey-token";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Credentials requires JWT sessions (no DB session row to look up).
  // maxAge ~100 years so the session only ends when the user signs out.
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 365 * 100 },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { email } });

        // Constant-ish work + identical null result on either failure so the
        // response doesn't reveal whether the email exists.
        const dummy = "$2a$12$0000000000000000000000000000000000000000000000000000";
        const valid = await verifyPassword(password, user?.passwordHash ?? dummy);

        if (!user || !valid) {
          return null;
        }

        return { id: user.id, email: user.email };
      },
    }),
    // Passkey bridge: the WebAuthn assertion is verified in our own API route
    // (src/app/api/passkey/login/verify), which mints a short-lived signed
    // token. We only re-verify that token here and load the user — no password,
    // no WebAuthn logic in Auth.js.
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: { token: {} },
      async authorize(raw) {
        const token = typeof raw?.token === "string" ? raw.token : null;

        if (!token) {
          return null;
        }

        const userId = await verifyPasskeyToken(token);

        if (!userId) {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
          return null;
        }

        return { id: user.id, email: user.email };
      },
    }),
  ],
});
