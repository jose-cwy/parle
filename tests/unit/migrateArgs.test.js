const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('path')
const {
  parseArgs,
  checksum,
  loadMigrations,
  PRIMARY_BRANCH_ID,
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
})
