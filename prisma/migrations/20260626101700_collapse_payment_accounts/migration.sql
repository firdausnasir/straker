-- Collapse two-layer PaymentAccount→Card into a single flat PaymentAccount,
-- add User.defaultAccountId, rename Commitment.cardId → accountId.
-- ONE-WAY migration with data back-fill. Old cards become PaymentAccount rows
-- (id preserved), so a commitment's old cardId is its new accountId verbatim.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- New flat PaymentAccount: drop `type`, add `last4`.
CREATE TABLE "new_PaymentAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last4" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Carry over bare old accounts (last4 N/A → NULL).
INSERT INTO "new_PaymentAccount" ("id", "userId", "name", "last4", "createdAt", "updatedAt")
SELECT "id", "userId", "name", NULL, "createdAt", "updatedAt" FROM "PaymentAccount";

-- Promote each old card to a flat account (id preserved; name = card label).
-- OR IGNORE is defensive against PK collisions (cuid space is disjoint, so 0 expected).
-- On a fresh DB the Card table is empty → 0 rows, harmless.
INSERT OR IGNORE INTO "new_PaymentAccount" ("id", "userId", "name", "last4", "createdAt", "updatedAt")
SELECT c."id", pa."userId", c."label", c."last4", c."createdAt", c."updatedAt"
FROM "Card" c JOIN "PaymentAccount" pa ON c."accountId" = pa."id";

-- New Commitment: cardId → accountId, FK now points at PaymentAccount (SetNull).
CREATE TABLE "new_Commitment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "nextDueDate" DATETIME NOT NULL,
    "renewalMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "accountId" TEXT,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reminderLeadDays" INTEGER NOT NULL DEFAULT 3,
    "reminderSentForDueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Commitment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Commitment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PaymentAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Old cardId already equals the new account id (card → account, id preserved).
INSERT INTO "new_Commitment" ("id", "userId", "name", "type", "amountMinor", "currency", "cycle", "nextDueDate", "renewalMode", "isActive", "notes", "accountId", "reminderEnabled", "reminderLeadDays", "reminderSentForDueDate", "createdAt", "updatedAt")
SELECT "id", "userId", "name", "type", "amountMinor", "currency", "cycle", "nextDueDate", "renewalMode", "isActive", "notes", "cardId", "reminderEnabled", "reminderLeadDays", "reminderSentForDueDate", "createdAt", "updatedAt" FROM "Commitment";

DROP TABLE "Commitment";
DROP TABLE "Card";
DROP TABLE "PaymentAccount";
ALTER TABLE "new_PaymentAccount" RENAME TO "PaymentAccount";
ALTER TABLE "new_Commitment" RENAME TO "Commitment";

-- Add nullable defaultAccountId FK to User (SetNull on account delete).
ALTER TABLE "User" ADD COLUMN "defaultAccountId" TEXT REFERENCES "PaymentAccount" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Recreate indexes.
CREATE INDEX "PaymentAccount_userId_idx" ON "PaymentAccount"("userId");
CREATE INDEX "Commitment_userId_isActive_nextDueDate_idx" ON "Commitment"("userId", "isActive", "nextDueDate");
CREATE INDEX "Commitment_accountId_idx" ON "Commitment"("accountId");
