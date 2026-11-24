// Applies the SQL migrations in ./drizzle to the database. Runs before every
// `next build`, so a Vercel deploy always has the tables it needs.
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

// Prefer the direct (unpooled) connection for migrations, as Neon recommends.
const raw = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL

if (!raw) {
  console.error(
    '\n✖ No database connection string found (DATABASE_URL).\n' +
      '  On Vercel: Project → Storage → connect the Neon database, then redeploy.\n' +
      '  Locally: put DATABASE_URL=... in .env.local.\n',
  )
  process.exit(1)
}

// pg treats sslmode=require as verify-full and warns about it; say so explicitly.
const connectionString = raw.replace(/sslmode=(require|prefer|verify-ca)\b/, 'sslmode=verify-full')

const client = new pg.Client({ connectionString })
await client.connect()
try {
  // Two deploys can build at the same time; only one should migrate at once.
  await client.query('SELECT pg_advisory_lock(727274)')
  await migrate(drizzle(client), { migrationsFolder: 'drizzle' })
  console.log('✓ Database is up to date')
} finally {
  await client.query('SELECT pg_advisory_unlock(727274)').catch(() => {})
  await client.end()
}
