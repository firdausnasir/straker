import type { DefaultSession } from "next-auth";

// Expose the user id on the session (we store it on the JWT and copy it in the
// session callback).
declare module "next-auth" {
  interface Session {
    user: { id: string } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
