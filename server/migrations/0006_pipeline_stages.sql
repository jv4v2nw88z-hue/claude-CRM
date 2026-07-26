-- Pipeline stages become rows, and Deal.stage becomes a foreign key.
--
-- Three things happen here, in an order that matters:
--   1. PipelineStage is created and seeded with the five stages that were
--      previously hard-coded in the Zod enum.
--   2. Any stage string in the existing data that ISN'T one of those five is
--      turned into its own stage row, so a value written before this migration
--      cannot be silently swallowed. On a database that only ever saw the enum
--      this inserts nothing; it exists so the migration is safe on one that did.
--   3. Deal is rebuilt with stageId, joined by name.
--
-- Fixed ids ('stage_new' and friends) rather than generated ones: the seed, the
-- lifecycle test and step 3's join all need to name these rows, and a
-- reproducible id means the migration produces the same database everywhere.

-- CreateTable
CREATE TABLE "PipelineStage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isWon" BOOLEAN NOT NULL DEFAULT false,
    "isLost" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The five stages that were previously the DEAL_STAGES enum.
INSERT INTO "PipelineStage" ("id", "name", "order", "isWon", "isLost") VALUES
    ('stage_new',       'New',       100, false, false),
    ('stage_contacted', 'Contacted', 200, false, false),
    ('stage_quoted',    'Quoted',    300, false, false),
    ('stage_won',       'Won',       400, true,  false),
    ('stage_lost',      'Lost',      500, false, true);

-- Rescue any stage value that predates the enum. randomblob(16) is only used
-- for these strays, so the canonical five keep their fixed ids.
INSERT INTO "PipelineStage" ("id", "name", "order", "isWon", "isLost")
SELECT
    'stage_' || lower(hex(randomblob(8))),
    d."stage",
    600 + ROW_NUMBER() OVER (ORDER BY d."stage"),
    false,
    false
FROM (SELECT DISTINCT "stage" FROM "Deal") d
WHERE d."stage" NOT IN (SELECT "name" FROM "PipelineStage");

-- CreateTable
CREATE TABLE "DealStageEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealId" TEXT NOT NULL,
    "fromStageId" TEXT,
    "fromStageName" TEXT,
    "toStageId" TEXT,
    "toStageName" TEXT NOT NULL,
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "note" TEXT,
    CONSTRAINT "DealStageEntry_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DealStageEntry_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "PipelineStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DealStageEntry_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "PipelineStage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DealStageEntry_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "businessName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "source" TEXT,
    "stageId" TEXT NOT NULL,
    "estimatedValue" REAL,
    "notes" TEXT,
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "stageChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lostReason" TEXT,
    CONSTRAINT "Deal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- The data migration proper. COALESCE is belt-and-braces: step 2 guarantees a
-- matching row exists for every distinct stage value, so the fallback to
-- 'stage_new' can only fire if that guarantee is somehow broken, and landing a
-- deal in the first column beats failing the migration on a NOT NULL violation.
INSERT INTO "new_Deal" ("id", "businessName", "contactName", "contactEmail", "contactPhone", "source", "stageId", "estimatedValue", "notes", "clientId", "createdAt", "updatedAt", "stageChangedAt", "lostReason")
SELECT
    d."id", d."businessName", d."contactName", d."contactEmail", d."contactPhone", d."source",
    COALESCE(ps."id", 'stage_new'),
    d."estimatedValue", d."notes", d."clientId", d."createdAt", d."updatedAt", d."stageChangedAt", d."lostReason"
FROM "Deal" d
LEFT JOIN "PipelineStage" ps ON ps."name" = d."stage";

DROP TABLE "Deal";
ALTER TABLE "new_Deal" RENAME TO "Deal";
CREATE INDEX "Deal_stageId_idx" ON "Deal"("stageId");
CREATE INDEX "Deal_clientId_idx" ON "Deal"("clientId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Seed each existing deal's opening history entry.
--
-- Not invented data: stageChangedAt already records when the deal last moved,
-- so this states exactly what the old schema knew — "as of this timestamp it
-- was in this stage" — and nothing it didn't. fromStage is null because the
-- prior stage genuinely was not recorded. Without this every pre-existing deal
-- would show an empty timeline, which reads as "never moved" rather than "not
-- tracked before now".
INSERT INTO "DealStageEntry" ("id", "dealId", "fromStageId", "fromStageName", "toStageId", "toStageName", "changedAt", "changedById", "note")
SELECT
    'dse_' || lower(hex(randomblob(12))),
    d."id", NULL, NULL, d."stageId", ps."name", d."stageChangedAt", NULL,
    'Stage as of the pipeline-stage migration'
FROM "Deal" d
JOIN "PipelineStage" ps ON ps."id" = d."stageId";

-- CreateIndex
CREATE UNIQUE INDEX "PipelineStage_name_key" ON "PipelineStage"("name");
CREATE INDEX "PipelineStage_order_idx" ON "PipelineStage"("order");
CREATE INDEX "DealStageEntry_dealId_changedAt_idx" ON "DealStageEntry"("dealId", "changedAt");
