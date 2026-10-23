const test = require('node:test')
const assert = require('node:assert/strict')
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
  EXPECTED_PROJECT_ID,
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
