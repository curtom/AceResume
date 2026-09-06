import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { ApiEnvironment } from '@aceresume/config';

export function createDatabaseConnection(environment: ApiEnvironment) {
  const client = postgres(environment.DATABASE_URL);
  return { client, db: drizzle(client) };
}
