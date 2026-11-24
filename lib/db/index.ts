import 'server-only'
import { attachDatabasePool } from '@vercel/functions'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>

// Reuse one pool per server instance (and across hot reloads in development).
const cache = globalThis as unknown as { __shopDb?: { pool: Pool; db: Db } }

function connectionString() {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!raw) {
    throw new Error('DATABASE_URL is not set. Connect the Neon database to this project (Vercel → Storage).')
  }
  // pg treats sslmode=require as verify-full and warns about it; say so explicitly.
  return raw.replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full')
}

/**
 * Neon + Vercel Fluid compute: a normal Postgres pool, attached so Vercel
 * closes idle connections before an instance is suspended.
 */
export function getDb(): Db {
  if (!cache.__shopDb) {
    const pool = new Pool({ connectionString: connectionString(), max: 5, idleTimeoutMillis: 10_000 })
    attachDatabasePool(pool)
    cache.__shopDb = { pool, db: drizzle(pool, { schema }) }
  }
  return cache.__shopDb.db
}

export { schema }
