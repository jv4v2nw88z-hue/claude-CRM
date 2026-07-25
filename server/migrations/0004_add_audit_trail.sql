-- Backfill note: the seven INSERT ... SELECT statements below name
-- "updatedAt" explicitly and source it from each row's creation timestamp.
-- Prisma's generated rebuild omits the new NOT NULL column, which aborts the
-- migration on any table that already has rows.

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedById" TEXT,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AutomationRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "triggerTier" TEXT,
    "anchor" TEXT NOT NULL DEFAULT 'TIER_CHANGE',
    "daysAfterTrigger" INTEGER NOT NULL,
    "repeatEveryDays" INTEGER,
    "requiresActiveRetainer" BOOLEAN NOT NULL DEFAULT false,
    "taskTitleTemplate" TEXT NOT NULL,
    "taskType" TEXT NOT NULL DEFAULT 'AUTO_UPSELL_PITCH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_AutomationRule" ("updatedAt", "anchor", "createdAt", "daysAfterTrigger", "id", "isActive", "name", "repeatEveryDays", "requiresActiveRetainer", "taskTitleTemplate", "taskType", "triggerTier") SELECT "createdAt", "anchor", "createdAt", "daysAfterTrigger", "id", "isActive", "name", "repeatEveryDays", "requiresActiveRetainer", "taskTitleTemplate", "taskType", "triggerTier" FROM "AutomationRule";
DROP TABLE "AutomationRule";
ALTER TABLE "new_AutomationRule" RENAME TO "AutomationRule";
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Contact" ("updatedAt", "clientId", "createdAt", "email", "firstName", "id", "isActive", "isPrimary", "lastName", "phone", "title") SELECT "createdAt", "clientId", "createdAt", "email", "firstName", "id", "isActive", "isPrimary", "lastName", "phone", "title" FROM "Contact";
DROP TABLE "Contact";
ALTER TABLE "new_Contact" RENAME TO "Contact";
CREATE INDEX "Contact_clientId_idx" ON "Contact"("clientId");
CREATE TABLE "new_Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "source" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'New',
    "estimatedValue" REAL,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "stageChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lostReason" TEXT,
    CONSTRAINT "Deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deal" ("updatedAt", "businessName", "clientId", "contactEmail", "contactName", "contactPhone", "createdAt", "estimatedValue", "id", "lostReason", "notes", "source", "stage", "stageChangedAt") SELECT "createdAt", "businessName", "clientId", "contactEmail", "contactName", "contactPhone", "createdAt", "estimatedValue", "id", "lostReason", "notes", "source", "stage", "stageChangedAt" FROM "Deal";
DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
CREATE INDEX "Deal_stage_idx" ON "Deal"("stage");
CREATE INDEX "Deal_clientId_idx" ON "Deal"("clientId");
CREATE TABLE "new_Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storageKey" TEXT,
    "category" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Document_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Document" ("updatedAt", "category", "clientId", "fileName", "fileUrl", "id", "storageKey", "uploadedAt") SELECT "uploadedAt", "category", "clientId", "fileName", "fileUrl", "id", "storageKey", "uploadedAt" FROM "Document";
DROP TABLE "Document";
ALTER TABLE "new_Document" RENAME TO "Document";
CREATE INDEX "Document_clientId_idx" ON "Document"("clientId");
CREATE TABLE "new_Interaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loggedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Interaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Interaction_loggedById_fkey" FOREIGN KEY ("loggedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Interaction" ("updatedAt", "clientId", "createdAt", "id", "loggedById", "occurredAt", "summary", "type") SELECT "createdAt", "clientId", "createdAt", "id", "loggedById", "occurredAt", "summary", "type" FROM "Interaction";
DROP TABLE "Interaction";
ALTER TABLE "new_Interaction" RENAME TO "Interaction";
CREATE INDEX "Interaction_clientId_occurredAt_idx" ON "Interaction"("clientId", "occurredAt");
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" DATETIME,
    "assignedToId" TEXT,
    "completedAt" DATETIME,
    "snoozedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "autoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "sourceRuleId" TEXT,
    CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_sourceRuleId_fkey" FOREIGN KEY ("sourceRuleId") REFERENCES "AutomationRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("updatedAt", "assignedToId", "autoGenerated", "clientId", "completedAt", "createdAt", "description", "dueDate", "id", "snoozedUntil", "sourceRuleId", "status", "title", "type") SELECT "createdAt", "assignedToId", "autoGenerated", "clientId", "completedAt", "createdAt", "description", "dueDate", "id", "snoozedUntil", "sourceRuleId", "status", "title", "type" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_clientId_idx" ON "Task"("clientId");
CREATE INDEX "Task_assignedToId_status_idx" ON "Task"("assignedToId", "status");
CREATE INDEX "Task_sourceRuleId_idx" ON "Task"("sourceRuleId");
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME
);
INSERT INTO "new_User" ("updatedAt", "createdAt", "email", "failedLoginCount", "id", "lockedUntil", "mustChangePassword", "name", "passwordHash", "role", "tokenVersion") SELECT "createdAt", "createdAt", "email", "failedLoginCount", "id", "lockedUntil", "mustChangePassword", "name", "passwordHash", "role", "tokenVersion" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_changedAt_idx" ON "AuditLog"("entity", "entityId", "changedAt");
