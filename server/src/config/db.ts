import { PrismaD1 } from "@prisma/adapter-d1";
import { PrismaClient } from "../generated/prisma/client";

/**
 * One Prisma client per request.
 *
 * Workers give each request an isolate that may or may not be reused, and a D1
 * binding is only valid for the request it arrived on — so unlike the Node
 * version there is no module-level singleton here. Constructing the client is
 * cheap: Prisma 7 compiles queries in WASM with no engine process to spawn.
 */
export function createPrisma(db: D1Database): PrismaClient {
  return new PrismaClient({ adapter: new PrismaD1(db) });
}

export type { PrismaClient };
