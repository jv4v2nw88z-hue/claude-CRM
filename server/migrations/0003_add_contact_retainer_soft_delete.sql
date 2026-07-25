-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("clientId", "createdAt", "email", "firstName", "id", "isPrimary", "lastName", "phone", "title") SELECT "clientId", "createdAt", "email", "firstName", "id", "isPrimary", "lastName", "phone", "title" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");
CREATE TABLE "new_Retainer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "monthlyAmount" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_FIRST_PAYMENT',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "billingDay" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Retainer_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Retainer" ("billingDay", "clientId", "createdAt", "endDate", "id", "monthlyAmount", "notes", "startDate", "status", "tier", "updatedAt") SELECT "billingDay", "clientId", "createdAt", "endDate", "id", "monthlyAmount", "notes", "startDate", "status", "tier", "updatedAt" FROM "Retainer";
DROP TABLE "Retainer";
ALTER TABLE "new_Retainer" RENAME TO "Retainer";
CREATE INDEX "Retainer_clientId_idx" ON "Retainer"("clientId");
CREATE INDEX "Retainer_status_idx" ON "Retainer"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
