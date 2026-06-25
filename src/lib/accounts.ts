import "server-only";
import type { Card, Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// A payment account with its cards eager-loaded, ordered for display.
export type AccountWithCards = Prisma.PaymentAccountGetPayload<{
  include: { cards: true };
}>;

// All of a user's payment accounts with their cards, accounts A→Z then cards by
// creation order. User-scoped — never leaks another user's accounts.
export async function getAccountsWithCards(userId: string): Promise<AccountWithCards[]> {
  return prisma.paymentAccount.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { cards: { orderBy: { createdAt: "asc" } } },
  });
}

// Ownership-checked single-card lookup: returns the card only if it belongs to
// an account owned by `userId`, else null. Used to validate a commitment's
// supplied cardId before persisting — the body is never trusted on its own.
export async function getCardForUser(userId: string, cardId: string): Promise<Card | null> {
  return prisma.card.findFirst({
    where: { id: cardId, account: { userId } },
  });
}
