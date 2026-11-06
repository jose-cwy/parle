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
const MIGRATION_LOCK_TIMEOUT = '5s'
const MIGRATION_STATEMENT_TIMEOUT = '30s'
const PRIMARY_ADDITIVE_MIGRATION = '0003_phase3_analytics.sql'
const EXPECTED_0003_CHECKSUM = '611daa96f31d10b73f5f86ea7aaaa39441ae1cd7234461e77da416180decf51a'
const PRIMARY_AUTH_MIGRATION = '0004_auth_identities.sql'
const EXPECTED_0004_CHECKSUM = '7bc29ddfe5d9f39129b8445218335fb3e5abd5c923f2822f01a4bedefa1494f0'
const PRIMARY_CONVERSATIONS_MIGRATION = '0005_conversations_v2.sql'
const EXPECTED_0005_CHECKSUM = '23e703266d35d8945edd28adb9151e1d1959a544b5d306bf7210d69c601fe251'
const PRIMARY_FOLLOW_ON = Object.freeze({
  '0006_conversation_lease_token.sql': {
    flag: 'executePrimary0006',
    cli: '--execute-primary-0006',
    checksum: '0b20eb485c0783aec17cae7414a1fc7c2330dba400560be7e824a31ceee4ba9e',
  },
  '0007_legacy_wrap_migration.sql': {
    flag: 'executePrimary0007',
    cli: '--execute-primary-0007',
    checksum: 'd85a0f1c8386d54bcfb9924f2ccb86c10b3505ab16ed8c61c2538e2b6ff15148',
  },
  '0008_legacy_wrap_origin_triggers.sql': {
    flag: 'executePrimary0008',
    cli: '--execute-primary-0008',
    checksum: '18420f1a50fd8aa11f1b5b557d4641faf0ea73cb04e000f4fff3d30316652628',
  },
  '0009_timeline_revision.sql': {
    flag: 'executePrimary0009',
    cli: '--execute-primary-0009',
    checksum: 'a4df15c0cd5a37eb951775bb931a57b93d737dcc07a3e30914a28e95fa404f37',
  },
  '0010_parle_ops_controls.sql': {
    flag: 'executePrimary0010',
    cli: '--execute-primary-0010',
    checksum: '299cbe82d498fa00dad1cbf59371fdd2016ed6eee6324fa7c1bec430e392a886',
  },
})

function parseArgs(argv, env = process.env) {
  return parseRehearsalFlags(argv, env)
}

function checksum(contents) {
  return crypto.createHash('sha256').update(contents).digest('hex')
}

function executableSql(sql) {
  return String(sql || '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
}

function sqlIsAdditive(sql) {
  const raw = String(sql || '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  if (/--\s*destructive\b/i.test(String(sql || ''))) return false
  if (/\bSET\s+SCHEMA\b/i.test(raw)) return false
  if (/\bTRUNCATE\b/i.test(raw)) return false
  if (/\bDELETE\s+FROM\b/i.test(raw)) return false
  if (/\bDROP\s+(TABLE|SCHEMA|DATABASE|COLUMN)\b/i.test(raw)) return false
  return true
}

function isForbiddenPrimaryMigration(version) {
  const name = String(version || '')
  return name.startsWith('0001_') || name.startsWith('0002_') || name.includes('archive_legacy')
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

function assertAuthorizedPrimary0003(args, migrations = []) {
  if (!args.authorizePrimaryAdditive) {
    throw new Error('Refusing: --authorize-primary-additive is required for the 0003 primary path')
  }
  if (args.allowDestructive) {
    throw new Error('Refusing: --allow-destructive is not permitted on the 0003 primary path')
  }
  if (args.migration !== PRIMARY_ADDITIVE_MIGRATION) {
    throw new Error(`Refusing: only ${PRIMARY_ADDITIVE_MIGRATION} may be authorized for primary`)
  }
  if (isForbiddenPrimaryMigration(args.migration)) {
    throw new Error(`Refusing to select ${args.migration} as an authorized additive migration`)
  }
  if (!args.expectedChecksum) {
    throw new Error('Refusing: --expected-checksum is required for the 0003 primary path')
  }
  if (args.expectedChecksum !== EXPECTED_0003_CHECKSUM) {
    throw new Error('Refusing: --expected-checksum does not match the approved 0003 hash')
  }
  const migration = migrations.find((row) => row.version === PRIMARY_ADDITIVE_MIGRATION)
  if (!migration) {
    throw new Error('Refusing: 0003_phase3_analytics.sql is missing')
  }
  if (migration.checksum !== EXPECTED_0003_CHECKSUM) {
    throw new Error('Refusing: on-disk 0003 checksum does not match the approved hash')
  }
  if (migration.checksum !== args.expectedChecksum) {
    throw new Error(`Checksum mismatch for ${migration.version}`)
  }
  if (migration.destructive || !sqlIsAdditive(migration.sql)) {
    throw new Error('Refusing non-additive 0003')
  }
  if (args.rehearsePrimaryAuthorization) {
    if (args.intendedPrimaryBranch !== PRIMARY_BRANCH_ID) {
      throw new Error(`Rehearsal must name intended primary ${PRIMARY_BRANCH_ID}`)
    }
  } else if (args.requireBranch !== PRIMARY_BRANCH_ID) {
    throw new Error(`Refusing: --require-branch must be ${PRIMARY_BRANCH_ID} for primary 0003`)
  }
}

function assertAuthorizedPrimary0004(args, migrations = []) {
  if (!args.authorizePrimaryAdditive) {
    throw new Error('Refusing: --authorize-primary-additive is required for the 0004 primary path')
  }
  if (args.allowDestructive) {
    throw new Error('Refusing: --allow-destructive is not permitted on the 0004 primary path')
  }
  if (args.migration !== PRIMARY_AUTH_MIGRATION) {
    throw new Error(`Refusing: only ${PRIMARY_AUTH_MIGRATION} may be authorized for primary auth`)
  }
  if (isForbiddenPrimaryMigration(args.migration)) {
    throw new Error(`Refusing to select ${args.migration} as an authorized additive migration`)
  }
  if (!args.expectedChecksum) {
    throw new Error('Refusing: --expected-checksum is required for the 0004 primary path')
  }
  if (args.expectedChecksum !== EXPECTED_0004_CHECKSUM) {
    throw new Error('Refusing: --expected-checksum does not match the approved 0004 hash')
  }
  const migration = migrations.find((row) => row.version === PRIMARY_AUTH_MIGRATION)
  if (!migration) {
    throw new Error('Refusing: 0004_auth_identities.sql is missing')
  }
  if (migration.checksum !== EXPECTED_0004_CHECKSUM) {
    throw new Error('Refusing: on-disk 0004 checksum does not match the approved hash')
  }
  if (migration.checksum !== args.expectedChecksum) {
    throw new Error(`Checksum mismatch for ${migration.version}`)
  }
  if (migration.destructive || !sqlIsAdditive(migration.sql)) {
    throw new Error('Refusing non-additive 0004')
  }
  if (args.rehearsePrimaryAuthorization) {
    if (args.intendedPrimaryBranch !== PRIMARY_BRANCH_ID) {
      throw new Error(`Rehearsal must name intended primary ${PRIMARY_BRANCH_ID}`)
    }
  } else if (args.requireBranch !== PRIMARY_BRANCH_ID) {
    throw new Error(`Refusing: --require-branch must be ${PRIMARY_BRANCH_ID} for primary 0004`)
  }
}

function isPrimaryAuthRehearsal(args) {
  return Boolean(args.rehearsePrimaryAuthorization && args.migration === PRIMARY_AUTH_MIGRATION)
}

function isPrimaryConversationsRehearsal(args) {
  return Boolean(args.rehearsePrimaryAuthorization && args.migration === PRIMARY_CONVERSATIONS_MIGRATION)
}

function primaryExecuteFlags(args) {
  const flags = []
  if (args.executePrimary0003) flags.push('--execute-primary-0003')
  if (args.executePrimary0004) flags.push('--execute-primary-0004')
  if (args.executePrimary0005) flags.push('--execute-primary-0005')
  for (const spec of Object.values(PRIMARY_FOLLOW_ON)) {
    if (args[spec.flag]) flags.push(spec.cli)
  }
  return flags
}

function followOnSpecFor(args) {
  const byFile = args.migration ? PRIMARY_FOLLOW_ON[args.migration] : null
  const byFlag = Object.entries(PRIMARY_FOLLOW_ON).find(([, spec]) => args[spec.flag])
  if (byFlag && byFile && byFlag[0] !== args.migration) {
    throw new Error(`Refusing: ${byFlag[1].cli} only authorizes ${byFlag[0]}`)
  }
  if (byFile) return { file: args.migration, ...byFile }
  if (byFlag) return { file: byFlag[0], ...byFlag[1] }
  return null
}

function isPrimaryFollowOnRehearsal(args) {
  return Boolean(args.rehearsePrimaryAuthorization && args.migration && PRIMARY_FOLLOW_ON[args.migration])
}

function assertAuthorizedPrimaryFollowOn(args, migrations = []) {
  const spec = followOnSpecFor(args)
  if (!spec) {
    throw new Error('Refusing: 0006–0010 primary path requires an exact follow-on migration filename')
  }
  if (!args.authorizePrimaryAdditive) {
    throw new Error(`Refusing: --authorize-primary-additive is required for the ${spec.file} primary path`)
  }
  if (args.allowDestructive) {
    throw new Error(`Refusing: --allow-destructive is not permitted on the ${spec.file} primary path`)
  }
  if (args.migration !== spec.file) {
    throw new Error(`Refusing: only ${spec.file} may be authorized for ${spec.cli}`)
  }
  if (isForbiddenPrimaryMigration(args.migration)) {
    throw new Error(`Refusing to select ${args.migration} as an authorized additive migration`)
  }
  if (!args.expectedChecksum) {
    throw new Error(`Refusing: --expected-checksum is required for the ${spec.file} primary path`)
  }
  if (args.expectedChecksum !== spec.checksum) {
    throw new Error(`Refusing: --expected-checksum does not match the approved ${spec.file} hash`)
  }
  const migration = migrations.find((row) => row.version === spec.file)
  if (!migration) {
    throw new Error(`Refusing: ${spec.file} is missing`)
  }
  if (migration.checksum !== spec.checksum) {
    throw new Error(`Refusing: on-disk ${spec.file} checksum does not match the approved hash`)
  }
  if (migration.checksum !== args.expectedChecksum) {
    throw new Error(`Checksum mismatch for ${migration.version}`)
  }
  if (migration.destructive || !sqlIsAdditive(migration.sql)) {
    throw new Error(`Refusing non-additive ${spec.file}`)
  }
  const executable = executableSql(migration.sql)
  if (
    /\bDELETE\s+FROM\b/i.test(executable) ||
    /\bTRUNCATE\b/i.test(executable) ||
    /\bUPDATE\s+(?!OF\b|ON\b)/i.test(executable)
  ) {
    throw new Error(`Refusing ${spec.file}: must not rewrite existing rows`)
  }
  if (spec.file === '0006_conversation_lease_token.sql') {
    if (!/ALTER TABLE conversation_requests/i.test(executable)) {
      throw new Error('Refusing 0006: expected ALTER TABLE conversation_requests')
    }
    if (/\bchat_memory\b/i.test(executable)) {
      throw new Error('Refusing 0006: must not touch chat_memory')
    }
  }
  if (spec.file === '0007_legacy_wrap_migration.sql') {
    if (!/CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_memory_id_user/i.test(executable)) {
      throw new Error('Refusing 0007: expected additive unique index on chat_memory (id, user_id)')
    }
    if (/\b(UPDATE|DELETE)\s+.*\bchat_memory\b/i.test(executable)) {
      throw new Error('Refusing 0007: must not rewrite chat_memory rows')
    }
  }
  if (spec.file === '0008_legacy_wrap_origin_triggers.sql' && /\bchat_memory\b/i.test(executable)) {
    throw new Error('Refusing 0008: must not touch chat_memory')
  }
  if (spec.file === '0009_timeline_revision.sql') {
    if (!/ALTER TABLE conversations/i.test(executable) || !/timeline_revision/i.test(executable)) {
      throw new Error('Refusing 0009: expected timeline_revision on conversations')
    }
    if (/\bchat_memory\b/i.test(executable)) {
      throw new Error('Refusing 0009: must not touch chat_memory')
    }
  }
  if (spec.file === '0010_parle_ops_controls.sql') {
    if (!/CREATE TABLE IF NOT EXISTS parle_ops_controls/i.test(executable)) {
      throw new Error('Refusing 0010: expected parle_ops_controls')
    }
    if (/\bchat_memory\b/i.test(executable)) {
      throw new Error('Refusing 0010: must not touch chat_memory')
    }
  }
  if (args.rehearsePrimaryAuthorization) {
    if (args.intendedPrimaryBranch !== PRIMARY_BRANCH_ID) {
      throw new Error(`Rehearsal must name intended primary ${PRIMARY_BRANCH_ID}`)
    }
  } else if (args.requireBranch !== PRIMARY_BRANCH_ID) {
    throw new Error(`Refusing: --require-branch must be ${PRIMARY_BRANCH_ID} for ${spec.file}`)
  }
}

function assertAuthorizedPrimary0005(args, migrations = []) {
  if (!args.authorizePrimaryAdditive) {
    throw new Error('Refusing: --authorize-primary-additive is required for the 0005 primary path')
  }
  if (args.allowDestructive) {
    throw new Error('Refusing: --allow-destructive is not permitted on the 0005 primary path')
  }
  if (args.migration !== PRIMARY_CONVERSATIONS_MIGRATION) {
    throw new Error(`Refusing: only ${PRIMARY_CONVERSATIONS_MIGRATION} may be authorized for primary conversations`)
  }
  if (isForbiddenPrimaryMigration(args.migration)) {
    throw new Error(`Refusing to select ${args.migration} as an authorized additive migration`)
  }
  if (!args.expectedChecksum) {
    throw new Error('Refusing: --expected-checksum is required for the 0005 primary path')
  }
  if (args.expectedChecksum !== EXPECTED_0005_CHECKSUM) {
    throw new Error('Refusing: --expected-checksum does not match the approved 0005 hash')
  }
  const migration = migrations.find((row) => row.version === PRIMARY_CONVERSATIONS_MIGRATION)
  if (!migration) {
    throw new Error('Refusing: 0005_conversations_v2.sql is missing')
  }
  if (migration.checksum !== EXPECTED_0005_CHECKSUM) {
    throw new Error('Refusing: on-disk 0005 checksum does not match the approved hash')
  }
  if (migration.checksum !== args.expectedChecksum) {
    throw new Error(`Checksum mismatch for ${migration.version}`)
  }
  if (migration.destructive || !sqlIsAdditive(migration.sql)) {
    throw new Error('Refusing non-additive 0005')
  }
  const executable = String(migration.sql || '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  if (/\b(chat_memory|auth_identities)\b/i.test(executable)) {
    throw new Error('Refusing 0005: must not touch chat_memory or auth tables')
  }
  if (/\b(ALTER|UPDATE|INSERT|LOCK)\b/i.test(executable)) {
    throw new Error('Refusing 0005: unexpected mutation of existing relations')
  }
  if (args.rehearsePrimaryAuthorization) {
    if (args.intendedPrimaryBranch !== PRIMARY_BRANCH_ID) {
      throw new Error(`Rehearsal must name intended primary ${PRIMARY_BRANCH_ID}`)
    }
  } else if (args.requireBranch !== PRIMARY_BRANCH_ID) {
    throw new Error(`Refusing: --require-branch must be ${PRIMARY_BRANCH_ID} for primary 0005`)
  }
}

function assertSafeIdentity(identity, args) {
  if (!identity.branch_id || !identity.project_id) {
    throw new Error('Could not confirm Neon branch identity (empty project_id or branch_id)')
  }
  if (identity.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error(`Refusing to migrate unexpected project_id ${identity.project_id}`)
  }
  const executeFlags = primaryExecuteFlags(args)
  if (executeFlags.length > 1) {
    throw new Error(`Refusing both ${executeFlags.join(' and ')}`)
  }
  const executeFlag = executeFlags[0]
  if (executeFlag && (args.rehearsal || args.rehearsePrimaryAuthorization)) {
    throw new Error(`Refusing ${executeFlag} with rehearsal flags`)
  }
  if (executeFlag && args.databaseUrlFlag) {
    throw new Error(`Refusing ${executeFlag} with --database-url= (use DATABASE_URL only)`)
  }
  if (args.rehearsal && identity.branch_id === PRIMARY_BRANCH_ID) {
    throw new Error('Refusing --rehearsal against the audited primary branch')
  }
  if (args.rehearsePrimaryAuthorization) {
    if (!args.rehearsal) {
      throw new Error('--rehearse-primary-authorization requires --rehearsal')
    }
    if (identity.branch_id === PRIMARY_BRANCH_ID) {
      throw new Error('Refusing primary-authorization rehearsal against the audited primary')
    }
    if (executeFlag) {
      throw new Error(`Refusing to mix ${executeFlag} with rehearsal`)
    }
  }

  if (identity.branch_id === PRIMARY_BRANCH_ID) {
    if (args.identityOnly) return
    if (!executeFlag) {
      throw new Error(
        'Primary execution is disabled until an explicit --execute-primary-0003 through --execute-primary-0010 approval' +
          (args.authorizePrimaryAdditive
            ? ' (--authorize-primary-additive is assembled but not executable)'
            : ''),
      )
    }
    if (args.requireBranch !== PRIMARY_BRANCH_ID) {
      throw new Error(
        `Branch mismatch: connected ${identity.branch_id} vs required ${args.requireBranch}`,
      )
    }
    return
  }

  if (executeFlag) {
    throw new Error(`Refusing ${executeFlag} against a non-primary branch`)
  }
  if (!args.identityOnly && identity.branch_id !== args.requireBranch) {
    throw new Error(
      `Branch mismatch: connected ${identity.branch_id || '(unknown)'} vs required ${args.requireBranch}`,
    )
  }
}

async function applyMigrationTimeouts(client) {
  await client.query(`SET LOCAL lock_timeout = '${MIGRATION_LOCK_TIMEOUT}'`)
  await client.query(`SET LOCAL statement_timeout = '${MIGRATION_STATEMENT_TIMEOUT}'`)
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

    if (args.executePrimary0004 || isPrimaryAuthRehearsal(args)) {
      assertAuthorizedPrimary0004(args, migrations)
    } else if (args.executePrimary0005 || isPrimaryConversationsRehearsal(args)) {
      assertAuthorizedPrimary0005(args, migrations)
    } else if (isPrimaryFollowOnRehearsal(args) || Object.values(PRIMARY_FOLLOW_ON).some((spec) => args[spec.flag])) {
      assertAuthorizedPrimaryFollowOn(args, migrations)
    } else if (args.executePrimary0003 || args.rehearsePrimaryAuthorization) {
      assertAuthorizedPrimary0003(args, migrations)
    }
    if (primaryExecuteFlags(args).length && args.dryRun) {
      throw new Error('Refusing --dry-run on the primary execute path')
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
      if (args.migration && migration.version !== args.migration) {
        continue
      }
      if (args.migration && args.expectedChecksum && migration.checksum !== args.expectedChecksum) {
        throw new Error(`Checksum mismatch for ${migration.version}`)
      }
      if (args.migration && !sqlIsAdditive(migration.sql)) {
        throw new Error(`Refusing non-additive migration ${migration.version}`)
      }
      if (isForbiddenPrimaryMigration(migration.version) && args.migration) {
        throw new Error(`Refusing to select ${migration.version} as an authorized additive migration`)
      }
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
        await applyMigrationTimeouts(client)
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
  sqlIsAdditive,
  isForbiddenPrimaryMigration,
  assertAuthorizedPrimary0003,
  assertAuthorizedPrimary0004,
  assertAuthorizedPrimary0005,
  assertAuthorizedPrimaryFollowOn,
  assertSafeIdentity,
  isPrimaryAuthRehearsal,
  isPrimaryConversationsRehearsal,
  primaryExecuteFlags,
  ADVISORY_LOCK_KEY,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
  PRIMARY_ADDITIVE_MIGRATION,
  EXPECTED_0003_CHECKSUM,
  PRIMARY_AUTH_MIGRATION,
  EXPECTED_0004_CHECKSUM,
  PRIMARY_CONVERSATIONS_MIGRATION,
  EXPECTED_0005_CHECKSUM,
  PRIMARY_FOLLOW_ON,
  MIGRATION_LOCK_TIMEOUT,
  MIGRATION_STATEMENT_TIMEOUT,
  applyMigrationTimeouts,
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })
}
