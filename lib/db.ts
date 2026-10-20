import "server-only";

import { createSqlClient } from "@/lib/postgres.mjs";

let sqlClient: ReturnType<typeof createSqlClient> | null = null;

export function getSql() {
  if (sqlClient) return sqlClient;

  sqlClient = createSqlClient();
  return sqlClient;
}
