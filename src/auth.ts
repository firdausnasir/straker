import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { credentialsSchema } from "@/lib/validation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Credentials requires JWT sessions (no DB session row to look up).
  session: { strategy: "jwt" },
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
  ],
});
