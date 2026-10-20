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
  }
  for (const raw of argv.slice(2)) {
    if (raw === '--rehearsal') args.rehearsal = true
    else if (raw === '--identity-only') args.identityOnly = true
    else if (raw === '--dry-run') args.dryRun = true
    else if (raw === '--allow-destructive') args.allowDestructive = true
    else if (raw === '--retry-failed') args.retryFailed = true
    else if (raw.startsWith('--require-branch=')) args.requireBranch = raw.slice('--require-branch='.length)
    else if (raw.startsWith('--database-url=')) args.databaseUrl = raw.slice('--database-url='.length)
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
