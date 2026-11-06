const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const {
  parseArgs,
  checksum,
  loadMigrations,
  PRIMARY_BRANCH_ID,
  assertAuthorizedPrimary0003,
  assertSafeIdentity,
  EXPECTED_0003_CHECKSUM,
  PRIMARY_ADDITIVE_MIGRATION,
  PRIMARY_AUTH_MIGRATION,
  EXPECTED_0004_CHECKSUM,
  assertAuthorizedPrimary0004,
  assertAuthorizedPrimary0005,
  PRIMARY_CONVERSATIONS_MIGRATION,
  EXPECTED_0005_CHECKSUM,
  PRIMARY_FOLLOW_ON,
  assertAuthorizedPrimaryFollowOn,
  EXPECTED_PROJECT_ID,
  MIGRATION_LOCK_TIMEOUT,
  MIGRATION_STATEMENT_TIMEOUT,
  applyMigrationTimeouts,
} = require('../../scripts/migrate')

test('parseArgs requires explicit flags', () => {
  const args = parseArgs(
    [
      'node',
      'migrate.js',
      '--require-branch=br-child',
      '--dry-run',
      '--allow-destructive',
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.equal(args.requireBranch, 'br-child')
  assert.equal(args.dryRun, true)
  assert.equal(args.allowDestructive, true)
  assert.equal(args.rehearsal, false)
  assert.equal(args.databaseUrl, 'postgres://primary.example/neondb')
  assert.equal(PRIMARY_BRANCH_ID, 'br-morning-sun-apghun9g')
})

test('--rehearsal uses REHEARSAL_DATABASE_URL and ignores DATABASE_URL', () => {
  const args = parseArgs(
    [
      'node',
      'migrate.js',
      '--rehearsal',
      '--require-branch=br-child',
      '--database-url=postgres://sneaky.example/neondb',
    ],
    {
      DATABASE_URL: 'postgres://primary.example/neondb',
      REHEARSAL_DATABASE_URL: 'postgres://child.example/neondb',
    },
  )
  assert.equal(args.rehearsal, true)
  assert.equal(args.databaseUrl, 'postgres://child.example/neondb')
})

test('--rehearsal does not fall back to DATABASE_URL when rehearsal URL is missing', () => {
  assert.throws(
    () =>
      parseArgs(['node', 'migrate.js', '--rehearsal', '--require-branch=br-child'], {
        DATABASE_URL: 'postgres://primary.example/neondb',
      }),
    /REHEARSAL_DATABASE_URL is not set/,
  )
})

test('checksum is stable for the same SQL', () => {
  assert.equal(checksum('SELECT 1;'), checksum('SELECT 1;'))
  assert.notEqual(checksum('SELECT 1;'), checksum('SELECT 2;'))
})

test('loadMigrations finds numbered SQL files', () => {
  const list = loadMigrations(path.join(__dirname, '../../database/migrations'))
  assert.ok(list.some((m) => m.version === '0001_keep_comments.sql'))
  assert.ok(list.some((m) => m.version === '0002_archive_legacy.sql' && m.destructive))
  assert.ok(list.some((m) => m.version === '0003_phase3_analytics.sql' && !m.destructive))
  const auth = list.find((m) => m.version === '0004_auth_identities.sql')
  assert.ok(auth && !auth.destructive)
  assert.equal(auth.checksum, EXPECTED_0004_CHECKSUM)
  const v2 = list.find((m) => m.version === '0005_conversations_v2.sql')
  assert.ok(v2 && !v2.destructive)
  const lease = list.find((m) => m.version === '0006_conversation_lease_token.sql')
  assert.ok(lease && !lease.destructive)
  const revision = list.find((m) => m.version === '0009_timeline_revision.sql')
  assert.ok(revision && !revision.destructive)
})

test('primary-looking flags still parse without enabling primary writes', () => {
  const args = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      '--migration=0003_phase3_analytics.sql',
      '--require-branch=br-morning-sun-apghun9g',
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.equal(args.authorizePrimaryAdditive, true)
  assert.equal(args.executePrimary0003, false)
  assert.equal(args.migration, '0003_phase3_analytics.sql')
  assert.equal(args.requireBranch, 'br-morning-sun-apghun9g')
})

test('authorized primary 0003 bundle requires filename, checksum, and primary branch', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const onDisk = migrations.find((row) => row.version === PRIMARY_ADDITIVE_MIGRATION)
  assert.equal(onDisk.checksum, EXPECTED_0003_CHECKSUM)

  const ok = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_ADDITIVE_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0003_CHECKSUM}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.doesNotThrow(() => assertAuthorizedPrimary0003(ok, migrations))

  const wrongFile = { ...ok, migration: '0001_keep_comments.sql' }
  assert.throws(() => assertAuthorizedPrimary0003(wrongFile, migrations), /only 0003/)

  const wrongSum = { ...ok, expectedChecksum: 'abc' }
  assert.throws(() => assertAuthorizedPrimary0003(wrongSum, migrations), /approved 0003 hash/)

  const destructive = { ...ok, allowDestructive: true }
  assert.throws(() => assertAuthorizedPrimary0003(destructive, migrations), /allow-destructive/)
})

test('primary execution stays disabled without --execute-primary-0003', () => {
  const identity = {
    project_id: EXPECTED_PROJECT_ID,
    branch_id: PRIMARY_BRANCH_ID,
  }
  const assembled = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_ADDITIVE_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0003_CHECKSUM}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.throws(
    () => assertSafeIdentity(identity, assembled),
    /Primary execution is disabled/,
  )
  assert.doesNotThrow(() => assertSafeIdentity(identity, { ...assembled, identityOnly: true }))
})

test('primary-authorization rehearsal names the real primary and refuses execute', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const args = parseArgs(
    [
      'node',
      'migrate.js',
      '--rehearsal',
      '--rehearse-primary-authorization',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_ADDITIVE_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0003_CHECKSUM}`,
      '--require-branch=br-misty-recipe-apcj8oyo',
      `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { REHEARSAL_DATABASE_URL: 'postgres://child.example/neondb' },
  )
  assert.doesNotThrow(() => assertAuthorizedPrimary0003(args, migrations))
  assert.doesNotThrow(() =>
    assertSafeIdentity(
      { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-misty-recipe-apcj8oyo' },
      args,
    ),
  )
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: PRIMARY_BRANCH_ID },
        args,
      ),
    /rehearsal against the audited primary/,
  )
  assert.throws(
    () => assertSafeIdentity(
      { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-misty-recipe-apcj8oyo' },
      { ...args, executePrimary0003: true },
    ),
    /execute-primary-0003 with rehearsal/,
  )
})

test('authorized primary 0004 bundle requires filename, checksum, and primary branch', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const onDisk = migrations.find((row) => row.version === PRIMARY_AUTH_MIGRATION)
  assert.equal(onDisk.checksum, EXPECTED_0004_CHECKSUM)
  assert.match(onDisk.sql, /email_verified_at/)
  assert.doesNotMatch(onDisk.sql, /\bUPDATE\s+users\b/i)
  assert.doesNotMatch(onDisk.sql, /\bDELETE\s+FROM\b/i)

  const ok = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_AUTH_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0004_CHECKSUM}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.equal(ok.executePrimary0004, false)
  assert.doesNotThrow(() => assertAuthorizedPrimary0004(ok, migrations))

  const wrongFile = { ...ok, migration: '0001_keep_comments.sql' }
  assert.throws(() => assertAuthorizedPrimary0004(wrongFile, migrations), /only 0004_auth_identities\.sql/)

  const archive = { ...ok, migration: '0002_archive_legacy.sql' }
  assert.throws(() => assertAuthorizedPrimary0004(archive, migrations), /only 0004_auth_identities\.sql/)

  const wrongSum = { ...ok, expectedChecksum: 'abc' }
  assert.throws(() => assertAuthorizedPrimary0004(wrongSum, migrations), /approved 0004 hash/)

  const destructive = { ...ok, allowDestructive: true }
  assert.throws(() => assertAuthorizedPrimary0004(destructive, migrations), /allow-destructive/)
})

test('primary 0004 execution stays disabled without --execute-primary-0004', () => {
  const identity = {
    project_id: EXPECTED_PROJECT_ID,
    branch_id: PRIMARY_BRANCH_ID,
  }
  const assembled = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_AUTH_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0004_CHECKSUM}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.throws(
    () => assertSafeIdentity(identity, assembled),
    /Primary execution is disabled/,
  )
  assert.doesNotThrow(() => assertSafeIdentity(identity, { ...assembled, identityOnly: true }))
  assert.doesNotThrow(() => assertSafeIdentity(identity, { ...assembled, executePrimary0004: true }))
  assert.throws(
    () => assertSafeIdentity(identity, { ...assembled, executePrimary0003: true, executePrimary0004: true }),
    /both --execute-primary-0003 and --execute-primary-0004/,
  )
})

test('primary-authorization rehearsal for 0004 names the real primary and refuses execute', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const args = parseArgs(
    [
      'node',
      'migrate.js',
      '--rehearsal',
      '--rehearse-primary-authorization',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_AUTH_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0004_CHECKSUM}`,
      '--require-branch=br-misty-recipe-apcj8oyo',
      `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { REHEARSAL_DATABASE_URL: 'postgres://child.example/neondb' },
  )
  assert.doesNotThrow(() => assertAuthorizedPrimary0004(args, migrations))
  assert.doesNotThrow(() =>
    assertSafeIdentity(
      { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-misty-recipe-apcj8oyo' },
      args,
    ),
  )
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: PRIMARY_BRANCH_ID },
        args,
      ),
    /rehearsal against the audited primary/,
  )
  assert.throws(
    () => assertSafeIdentity(
      { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-misty-recipe-apcj8oyo' },
      { ...args, executePrimary0004: true },
    ),
    /execute-primary-0004 with rehearsal/,
  )
})

test('authorized primary 0005 bundle requires filename, checksum, and primary branch', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const onDisk = migrations.find((row) => row.version === PRIMARY_CONVERSATIONS_MIGRATION)
  assert.equal(onDisk.checksum, EXPECTED_0005_CHECKSUM)
  assert.equal(onDisk.destructive, false)
  const executable = onDisk.sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
  assert.match(executable, /CREATE TABLE IF NOT EXISTS conversations/)
  assert.match(executable, /CREATE TABLE IF NOT EXISTS conversation_messages/)
  assert.match(executable, /CREATE TABLE IF NOT EXISTS conversation_requests/)
  assert.doesNotMatch(executable, /\bchat_memory\b/i)
  assert.doesNotMatch(executable, /\bDROP\b/i)
  assert.doesNotMatch(executable, /\bTRUNCATE\b/i)
  assert.doesNotMatch(executable, /\bDELETE\s+FROM\b/i)
  assert.doesNotMatch(executable, /\bALTER\s+TABLE\b/i)
  assert.doesNotMatch(executable, /\bUPDATE\b/i)

  const ok = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_CONVERSATIONS_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0005_CHECKSUM}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.equal(ok.executePrimary0005, false)
  assert.doesNotThrow(() => assertAuthorizedPrimary0005(ok, migrations))

  const missingAuth = { ...ok, authorizePrimaryAdditive: false }
  assert.throws(() => assertAuthorizedPrimary0005(missingAuth, migrations), /authorize-primary-additive/)

  const wrongFile = { ...ok, migration: '0006_conversation_lease_token.sql' }
  assert.throws(() => assertAuthorizedPrimary0005(wrongFile, migrations), /only 0005_conversations_v2\.sql/)

  const archive = { ...ok, migration: '0002_archive_legacy.sql' }
  assert.throws(() => assertAuthorizedPrimary0005(archive, migrations), /only 0005_conversations_v2\.sql/)

  const wrongSum = { ...ok, expectedChecksum: 'abc' }
  assert.throws(() => assertAuthorizedPrimary0005(wrongSum, migrations), /approved 0005 hash/)

  const wrongBranch = { ...ok, requireBranch: 'br-rough-lab-apixtzmm' }
  assert.throws(() => assertAuthorizedPrimary0005(wrongBranch, migrations), /require-branch must be/)

  const destructive = { ...ok, allowDestructive: true }
  assert.throws(() => assertAuthorizedPrimary0005(destructive, migrations), /allow-destructive/)
})

test('primary 0005 execution stays disabled without --execute-primary-0005', () => {
  const identity = {
    project_id: EXPECTED_PROJECT_ID,
    branch_id: PRIMARY_BRANCH_ID,
  }
  const assembled = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_CONVERSATIONS_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0005_CHECKSUM}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.throws(
    () => assertSafeIdentity(identity, assembled),
    /Primary execution is disabled/,
  )
  assert.doesNotThrow(() => assertSafeIdentity(identity, { ...assembled, identityOnly: true }))
  assert.doesNotThrow(() => assertSafeIdentity(identity, { ...assembled, executePrimary0005: true }))
  assert.throws(
    () => assertSafeIdentity(identity, { ...assembled, executePrimary0003: true, executePrimary0005: true }),
    /both --execute-primary-0003 and --execute-primary-0005/,
  )
  assert.throws(
    () => assertSafeIdentity(identity, { ...assembled, executePrimary0004: true, executePrimary0005: true }),
    /both --execute-primary-0004 and --execute-primary-0005/,
  )
})

test('primary 0005 execute refuses wrong project, wrong branch, and rehearsal', () => {
  const assembled = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      '--execute-primary-0005',
      `--migration=${PRIMARY_CONVERSATIONS_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0005_CHECKSUM}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.equal(assembled.executePrimary0005, true)
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: 'not-the-project', branch_id: PRIMARY_BRANCH_ID },
        assembled,
      ),
    /unexpected project_id/,
  )
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-rough-lab-apixtzmm' },
        assembled,
      ),
    /against a non-primary branch/,
  )
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: PRIMARY_BRANCH_ID },
        { ...assembled, rehearsal: true },
      ),
    /execute-primary-0005 with rehearsal/,
  )
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: PRIMARY_BRANCH_ID },
        { ...assembled, databaseUrlFlag: true },
      ),
    /database-url=/,
  )
})

test('primary-authorization rehearsal for 0005 names the real primary and refuses execute', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const args = parseArgs(
    [
      'node',
      'migrate.js',
      '--rehearsal',
      '--rehearse-primary-authorization',
      '--authorize-primary-additive',
      `--migration=${PRIMARY_CONVERSATIONS_MIGRATION}`,
      `--expected-checksum=${EXPECTED_0005_CHECKSUM}`,
      '--require-branch=br-rough-lab-apixtzmm',
      `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { REHEARSAL_DATABASE_URL: 'postgres://child.example/neondb' },
  )
  assert.doesNotThrow(() => assertAuthorizedPrimary0005(args, migrations))
  assert.doesNotThrow(() =>
    assertSafeIdentity(
      { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-rough-lab-apixtzmm' },
      args,
    ),
  )
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: PRIMARY_BRANCH_ID },
        args,
      ),
    /rehearsal against the audited primary/,
  )
  assert.throws(
    () => assertSafeIdentity(
      { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-rough-lab-apixtzmm' },
      { ...args, executePrimary0005: true },
    ),
    /execute-primary-0005 with rehearsal/,
  )
})

test('authorized primary 0006–0010 bundles require matching file, checksum, and primary branch', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  for (const [file, spec] of Object.entries(PRIMARY_FOLLOW_ON)) {
    const onDisk = migrations.find((row) => row.version === file)
    assert.equal(onDisk.checksum, spec.checksum, file)
    assert.equal(onDisk.destructive, false, file)
    assert.equal(require('../../scripts/migrate').sqlIsAdditive(onDisk.sql), true, file)

    const ok = parseArgs(
      [
        'node',
        'migrate.js',
        '--authorize-primary-additive',
        `--migration=${file}`,
        `--expected-checksum=${spec.checksum}`,
        `--require-branch=${PRIMARY_BRANCH_ID}`,
      ],
      { DATABASE_URL: 'postgres://primary.example/neondb' },
    )
    assert.equal(ok[spec.flag], false)
    assert.doesNotThrow(() => assertAuthorizedPrimaryFollowOn(ok, migrations))

    assert.throws(
      () => assertAuthorizedPrimaryFollowOn({ ...ok, authorizePrimaryAdditive: false }, migrations),
      /authorize-primary-additive/,
    )
    assert.throws(
      () => assertAuthorizedPrimaryFollowOn({ ...ok, expectedChecksum: 'abc' }, migrations),
      /approved/,
    )
    assert.throws(
      () => assertAuthorizedPrimaryFollowOn({ ...ok, allowDestructive: true }, migrations),
      /allow-destructive/,
    )
    assert.throws(
      () => assertAuthorizedPrimaryFollowOn({ ...ok, migration: '0002_archive_legacy.sql' }, migrations),
      /follow-on migration filename|only /,
    )
  }

  const lease = PRIMARY_FOLLOW_ON['0006_conversation_lease_token.sql']
  const mixed = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      '--execute-primary-0006',
      '--migration=0007_legacy_wrap_migration.sql',
      `--expected-checksum=${lease.checksum}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.throws(() => assertAuthorizedPrimaryFollowOn(mixed, migrations), /only authorizes 0006/)
})

test('primary 0006 execution stays disabled without --execute-primary-0006', () => {
  const identity = { project_id: EXPECTED_PROJECT_ID, branch_id: PRIMARY_BRANCH_ID }
  const file = '0006_conversation_lease_token.sql'
  const spec = PRIMARY_FOLLOW_ON[file]
  const assembled = parseArgs(
    [
      'node',
      'migrate.js',
      '--authorize-primary-additive',
      `--migration=${file}`,
      `--expected-checksum=${spec.checksum}`,
      `--require-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { DATABASE_URL: 'postgres://primary.example/neondb' },
  )
  assert.throws(() => assertSafeIdentity(identity, assembled), /Primary execution is disabled/)
  assert.doesNotThrow(() => assertSafeIdentity(identity, { ...assembled, executePrimary0006: true }))
  assert.throws(
    () => assertSafeIdentity(identity, { ...assembled, executePrimary0006: true, executePrimary0007: true }),
    /both --execute-primary-0006 and --execute-primary-0007/,
  )
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-rough-lab-apixtzmm' },
        { ...assembled, executePrimary0006: true },
      ),
    /against a non-primary branch/,
  )
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-rough-lab-apixtzmm' },
        { ...assembled, executePrimary0006: true, rehearsal: true },
      ),
    /execute-primary-0006 with rehearsal/,
  )
})

test('primary-authorization rehearsal for 0006 names the real primary and refuses execute', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const spec = PRIMARY_FOLLOW_ON['0006_conversation_lease_token.sql']
  const args = parseArgs(
    [
      'node',
      'migrate.js',
      '--rehearsal',
      '--rehearse-primary-authorization',
      '--authorize-primary-additive',
      '--migration=0006_conversation_lease_token.sql',
      `--expected-checksum=${spec.checksum}`,
      '--require-branch=br-rough-lab-apixtzmm',
      `--intended-primary-branch=${PRIMARY_BRANCH_ID}`,
    ],
    { REHEARSAL_DATABASE_URL: 'postgres://rehearsal.example/neondb' },
  )
  assert.equal(args.executePrimary0006, false)
  assert.doesNotThrow(() => assertAuthorizedPrimaryFollowOn(args, migrations))
  assert.throws(
    () =>
      assertSafeIdentity(
        { project_id: EXPECTED_PROJECT_ID, branch_id: 'br-rough-lab-apixtzmm' },
        { ...args, executePrimary0006: true },
      ),
    /rehearsal/,
  )
})

test('migration apply sets bounded lock_timeout and statement_timeout', async () => {
  assert.equal(MIGRATION_LOCK_TIMEOUT, '5s')
  assert.equal(MIGRATION_STATEMENT_TIMEOUT, '30s')
  const statements = []
  await applyMigrationTimeouts({
    query: async (sql) => {
      statements.push(sql)
    },
  })
  assert.deepEqual(statements, [
    "SET LOCAL lock_timeout = '5s'",
    "SET LOCAL statement_timeout = '30s'",
  ])
})

test('0011 write barrier is rehearsal-only and additive', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const file = migrations.find((row) => row.version === '0011_legacy_write_barrier.sql')
  assert.ok(file)
  assert.equal(file.destructive, false)
  assert.equal(require('../../scripts/migrate').sqlIsAdditive(file.sql), true)
  assert.equal(PRIMARY_FOLLOW_ON['0011_legacy_write_barrier.sql'], undefined)
  assert.doesNotMatch(file.sql, /\b(UPDATE|DELETE)\s+.*\bchat_memory\b/i)
})

test('0012 chat_memory write guard is rehearsal-only, additive, and SHARE-compatible', () => {
  const migrations = loadMigrations(path.join(__dirname, '../../database/migrations'))
  const file = migrations.find((row) => row.version === '0012_chat_memory_write_guard.sql')
  const migrateSrc = fs.readFileSync(path.join(__dirname, '../../scripts/migrate.js'), 'utf8')
  assert.ok(file)
  assert.equal(file.destructive, false)
  assert.equal(require('../../scripts/migrate').sqlIsAdditive(file.sql), true)
  assert.equal(PRIMARY_FOLLOW_ON['0012_chat_memory_write_guard.sql'], undefined)
  assert.match(file.sql, /FOR SHARE/)
  assert.match(file.sql, /BEFORE INSERT OR UPDATE OR DELETE ON chat_memory/)
  assert.doesNotMatch(file.sql, /\bDELETE\s+FROM\b/i)
  assert.doesNotMatch(file.sql, /\bUPDATE\s+chat_memory\b/i)
  assert.match(migrateSrc, /startsWith\('0012_'\)/)
})
