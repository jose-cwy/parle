#!/usr/bin/env node
/**
 * Apply database/migrations/*.sql to a named Postgres URL.
 * Editing database/schema.sql does not change Neon.
 *
 * Usage:
 *   node scripts/migrate.js --rehearsal --require-branch=br-xxx [--dry-run] [--allow-destructive] [--retry-failed]
 *   node scripts/migrate.js --rehearsal --identity-only
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { Client } = require('pg')
const {
  loadEnvLocal,
  publicHost,
  parseRehearsalFlags,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')

const ADVISORY_LOCK_KEY = 872451901

function parseArgs(argv, env = process.env) {
  return parseRehearsalFlags(argv, env)
}

function checksum(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex')
}

function loadMigrations(dir) {
  return fs
    .readdirSync(dir)
    .filter((name) => /^\d{4}_.+\.sql$/i.test(name))
    .sort()
    .map((name) => {
      const filePath = path.join(dir, name)
      const sql = fs.readFileSync(filePath, 'utf8')
      const destructive = /--\s*destructive\b/i.test(sql) || name.includes('archive_legacy')
      return { version: name, filePath, sql, checksum: checksum(sql), destructive }
    })
}

function createClient(databaseUrl) {
  return new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: true },
  })
}

async function readIdentity(client) {
  const result = await client.query(`
    select current_database() as db,
           current_setting('neon.project_id', true) as project_id,
           current_setting('neon.branch_id', true) as branch_id,
           current_setting('neon.endpoint_id', true) as endpoint_id
  `)
  return result.rows[0] || {}
}

function assertSafeIdentity(identity, args) {
  if (!identity.branch_id || !identity.project_id) {
    throw new Error('Could not confirm Neon branch identity (empty project_id or branch_id)')
  }
  if (identity.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error(`Refusing to migrate unexpected project_id ${identity.project_id}`)
  }
  if (identity.branch_id === PRIMARY_BRANCH_ID) {
    throw new Error('Refusing all migrations on the audited primary until named-object approval')
  }
  if (args.rehearsal && identity.branch_id === PRIMARY_BRANCH_ID) {
    throw new Error('Refusing --rehearsal against the audited primary branch')
  }
  if (!args.identityOnly && identity.branch_id !== args.requireBranch) {
    throw new Error(
      `Branch mismatch: connected ${identity.branch_id || '(unknown)'} vs required ${args.requireBranch}`,
    )
  }
}

async function ensureLedger(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ,
      status TEXT NOT NULL CHECK (status IN ('applied', 'failed')),
      error TEXT
    )
  `)
}

async function main() {
  loadEnvLocal()
  const args = parseArgs(process.argv)
  if (args.rehearsal && !args.databaseUrl) {
    console.error('REHEARSAL_DATABASE_URL is required with --rehearsal')
    process.exit(1)
  }
  if (!args.databaseUrl) {
    console.error('DATABASE_URL is required (env or --database-url=), or pass --rehearsal')
    process.exit(1)
  }
  if (!args.identityOnly && !args.requireBranch) {
    console.error('--require-branch=<neon.branch_id> is required so the wrong database cannot be migrated silently')
    process.exit(1)
  }

  const migrationsDir = path.join(__dirname, '..', 'database', 'migrations')
  const migrations = loadMigrations(migrationsDir)
  const client = createClient(args.databaseUrl)
  await client.connect()

  let locked = false
  try {
    const identity = await readIdentity(client)
    console.log(
      JSON.stringify({
        db: identity.db,
        project_id: identity.project_id,
        branch_id: identity.branch_id,
        endpoint_id: identity.endpoint_id,
        host: publicHost(args.databaseUrl),
        rehearsal: Boolean(args.rehearsal),
      }),
    )
    assertSafeIdentity(identity, args)

    if (args.identityOnly) {
      console.log('IDENTITY_ONLY=ok')
      return
    }

    const lock = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [ADVISORY_LOCK_KEY])
    if (!lock.rows[0].ok) {
      throw new Error('Another migration is running (advisory lock held)')
    }
    locked = true

    await ensureLedger(client)
    const applied = await client.query('SELECT version, checksum, status, error FROM schema_migrations')
    const byVersion = new Map(applied.rows.map((row) => [row.version, row]))

    for (const migration of migrations) {
      if (migration.destructive && !args.allowDestructive) {
        console.log('SKIP_DESTRUCTIVE', migration.version)
        continue
      }

      const existing = byVersion.get(migration.version)
      if (existing?.status === 'applied') {
        if (existing.checksum !== migration.checksum) {
          throw new Error(`Checksum mismatch for applied migration ${migration.version}`)
        }
        console.log('SKIP_APPLIED', migration.version)
        continue
      }
      if (existing?.status === 'failed' && !args.retryFailed) {
        throw new Error(
          `Migration ${migration.version} previously failed. Fix the file then pass --retry-failed`,
        )
      }

      if (args.dryRun) {
        console.log('DRY_RUN', migration.version)
        continue
      }

      try {
        await client.query('BEGIN')
        await client.query(migration.sql)
        await client.query(
          `INSERT INTO schema_migrations (version, checksum, applied_at, status, error)
           VALUES ($1, $2, now(), 'applied', NULL)
           ON CONFLICT (version) DO UPDATE SET
             checksum = EXCLUDED.checksum,
             applied_at = EXCLUDED.applied_at,
             status = 'applied',
             error = NULL`,
          [migration.version, migration.checksum],
        )
        await client.query('COMMIT')
        console.log('APPLIED', migration.version)
      } catch (error) {
        try {
          await client.query('ROLLBACK')
        } catch {
          /* ignore */
        }
        const message = String(error.message || error).slice(0, 500)
        await client.query(
          `INSERT INTO schema_migrations (version, checksum, applied_at, status, error)
           VALUES ($1, $2, now(), 'failed', $3)
           ON CONFLICT (version) DO UPDATE SET
             checksum = EXCLUDED.checksum,
             applied_at = EXCLUDED.applied_at,
             status = 'failed',
             error = EXCLUDED.error`,
          [migration.version, migration.checksum, message],
        )
        console.error('FAILED', migration.version)
        throw error
      }
    }
  } finally {
    if (locked) {
      await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_KEY]).catch(() => {})
    }
    await client.end().catch(() => {})
  }
}

module.exports = {
  parseArgs,
  checksum,
  loadMigrations,
  ADVISORY_LOCK_KEY,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })
}
