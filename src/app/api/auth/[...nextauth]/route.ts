import { handlers } from "@/auth";

// Auth.js owns the entire /api/auth/* namespace (signin, signout, session,
// callback, csrf). Registration lives at /api/register to avoid the collision.
export const { GET, POST } = handlers;
