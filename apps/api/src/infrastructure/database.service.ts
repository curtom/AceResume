import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import type { ApiEnvironment } from '@aceresume/config';
import { API_ENVIRONMENT } from '../bootstrap/environment.module.js';
import * as schema from './schema.js';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client: Sql;
  readonly db: PostgresJsDatabase<typeof schema>;

  constructor(@Inject(API_ENVIRONMENT) environment: ApiEnvironment) {
    this.client = postgres(environment.DATABASE_URL);
    this.db = drizzle(this.client, { schema });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 3 });
  }
}
