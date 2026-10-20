#!/usr/bin/env node
/**
 * Spawns the child-only app-flow worker with DATABASE_URL overridden in-process
 * to REHEARSAL_DATABASE_URL. Does not change .env.local.
 */
const { spawnSync } = require('child_process')
const path = require('path')
const { loadEnvLocal, resolveRehearsalUrl } = require('./rehearsalEnv')

loadEnvLocal()
const rehearsalUrl = resolveRehearsalUrl()
const result = spawnSync(process.execPath, [path.join(__dirname, 'rehearse-app-flows-worker.js')], {
  env: { ...process.env, DATABASE_URL: rehearsalUrl },
  encoding: 'utf8',
  cwd: path.join(__dirname, '..'),
})
process.stdout.write(result.stdout || '')
process.stderr.write(result.stderr || '')
process.exit(result.status == null ? 1 : result.status)
