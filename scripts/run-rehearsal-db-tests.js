#!/usr/bin/env node
const { spawnSync } = require('child_process')
const { loadEnvLocal, resolveRehearsalUrl } = require('./rehearsalEnv')

loadEnvLocal()
const rehearsalUrl = resolveRehearsalUrl()
const result = spawnSync(
  process.execPath,
  ['--test', 'tests/unit/sessionPersist.test.js', 'tests/unit/migrateArgs.test.js'],
  {
    env: {
      ...process.env,
      DATABASE_URL: rehearsalUrl,
    },
    encoding: 'utf8',
    cwd: require('path').join(__dirname, '..'),
  },
)
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
process.exit(result.status == null ? 1 : result.status)
