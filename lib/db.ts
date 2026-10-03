import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let sqlClient: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (sqlClient) return sqlClient;

  const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL no está configurada.");
  }

  sqlClient = neon(databaseUrl);
  return sqlClient;
}
