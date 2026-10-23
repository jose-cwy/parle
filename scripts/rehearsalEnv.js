const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')

const PRIMARY_BRANCH_ID = 'br-morning-sun-apghun9g'
const EXPECTED_PROJECT_ID = 'little-truth-88273418'

function publicHost(connectionString) {
  try {
    return new URL(String(connectionString).replace(/^postgres(ql)?:/i, 'https:')).hostname
  } catch {
    return 'unparsed'
  }
}

function resolveRehearsalUrl(env = process.env) {
  const url = String(env.REHEARSAL_DATABASE_URL || '').trim()
  if (!url) {
    throw new Error('REHEARSAL_DATABASE_URL is not set')
  }
  return url
}

function parseRehearsalFlags(argv, env = process.env) {
  const args = {
    rehearsal: false,
    identityOnly: false,
    requireBranch: null,
    dryRun: false,
    allowDestructive: false,
    retryFailed: false,
    databaseUrl: '',
    migration: null,
    expectedChecksum: null,
    authorizePrimaryAdditive: false,
    executePrimary0003: false,
    executePrimary0004: false,
    rehearsePrimaryAuthorization: false,
    intendedPrimaryBranch: null,
    databaseUrlFlag: false,
  }
  for (const raw of argv.slice(2)) {
    if (raw === '--rehearsal') args.rehearsal = true
    else if (raw === '--identity-only') args.identityOnly = true
    else if (raw === '--dry-run') args.dryRun = true
    else if (raw === '--allow-destructive') args.allowDestructive = true
    else if (raw === '--retry-failed') args.retryFailed = true
    else if (raw === '--authorize-primary-additive') args.authorizePrimaryAdditive = true
    else if (raw === '--execute-primary-0003') args.executePrimary0003 = true
    else if (raw === '--execute-primary-0004') args.executePrimary0004 = true
    else if (raw === '--rehearse-primary-authorization') args.rehearsePrimaryAuthorization = true
    else if (raw.startsWith('--require-branch=')) args.requireBranch = raw.slice('--require-branch='.length)
    else if (raw.startsWith('--intended-primary-branch=')) {
      args.intendedPrimaryBranch = raw.slice('--intended-primary-branch='.length)
    }
    else if (raw.startsWith('--database-url=')) {
      args.databaseUrlFlag = true
      args.databaseUrl = raw.slice('--database-url='.length)
    }
    else if (raw.startsWith('--migration=')) args.migration = raw.slice('--migration='.length)
    else if (raw.startsWith('--expected-checksum=')) args.expectedChecksum = raw.slice('--expected-checksum='.length)
  }
  if (args.rehearsal) {
    // Never fall back to DATABASE_URL or --database-url=.
    args.databaseUrl = resolveRehearsalUrl(env)
  } else if (!args.databaseUrl) {
    args.databaseUrl = String(env.DATABASE_URL || '').trim()
  }
  return args
}

module.exports = {
  loadEnvLocal,
  publicHost,
  resolveRehearsalUrl,
  parseRehearsalFlags,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
}
