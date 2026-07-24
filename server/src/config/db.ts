import { PrismaClient, Prisma } from "@prisma/client";

// Prisma returns Decimal columns as Decimal instances, which JSON.stringify
// renders as a string. Every money value in this app is small and well inside
// float range, so serialise them as plain numbers — the frontend does arithmetic
// on MRR and should never have to parse strings.
(Prisma.Decimal.prototype as unknown as { toJSON: () => number }).toJSON =
  function toJSON(this: Prisma.Decimal) {
    return this.toNumber();
  };

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
