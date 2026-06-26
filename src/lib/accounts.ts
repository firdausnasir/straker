import "server-only";
import type { PaymentAccount } from "@prisma/client";
import { prisma } from "./prisma";

// A single flat payment account row.
export type AccountRow = PaymentAccount;

// Thrown when a default-account write targets a row the user does not own (or
// that does not exist). Routes map this to a 404.
export class AccountNotFoundError extends Error {
  constructor() {
    super("Account not found");
    this.name = "AccountNotFoundError";
  }
}

// All of a user's payment accounts, A→Z by name. User-scoped — never leaks
// another user's accounts.
export async function getAccounts(userId: string): Promise<AccountRow[]> {
  return prisma.paymentAccount.findMany({
    where: { userId },
    orderBy: { name: "asc" },
  });
}

// Ownership-checked single-account lookup: returns the row only if it belongs
// to `userId`, else null. Used to validate a commitment's supplied accountId
// before persisting — the body is never trusted on its own.
export async function getAccountForUser(userId: string, id: string): Promise<AccountRow | null> {
  return prisma.paymentAccount.findFirst({
    where: { id, userId },
  });
}

// The user's current default payment account, or null if none is set / the
// default was cleared by an account delete (SetNull at the schema layer).
export async function getDefaultAccount(userId: string): Promise<AccountRow | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { defaultAccount: true },
  });

  return user?.defaultAccount ?? null;
}

// Make `id` the user's default account. The at-most-one invariant falls out of
// writing a single User.defaultAccountId column — no "clear prior" step needed.
// Rejects cross-user / unknown ids with AccountNotFoundError.
export async function setDefaultAccount(userId: string, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // Confirm ownership before writing the FK — a foreign or missing id must
    // not become a user's default. (A no-op updateMany can't be used here:
    // Prisma treats empty `data` as a no-op and reports count 0 even when the
    // row exists, so count it explicitly.)
    const owned = await tx.paymentAccount.count({ where: { id, userId } });
    if (owned === 0) {
      throw new AccountNotFoundError();
    }

    await tx.user.update({
      where: { id: userId },
      data: { defaultAccountId: id },
    });
  });
}

// Clear the user's default account. No-op if already null.
export async function clearDefaultAccount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { defaultAccountId: null },
  });
}
