const { spawnSync } = require('child_process')
const path = require('path')
const { loadEnvLocal } = require('../tests/helpers/loadEnvLocal')
const { signToken } = require('../lib/auth')

loadEnvLocal()

async function main() {
  const db = require('../lib/db')
  const result = await db.query(
    `SELECT id, email FROM users WHERE email = ANY($1)`,
    [['testuser_a@parle.test', 'testuser_b@parle.test', 'testuser_legacy@parle.test']],
  )
  const userA = result.rows.find((row) => row.email === 'testuser_a@parle.test')
  const userB = result.rows.find((row) => row.email === 'testuser_b@parle.test')
  const userLegacy = result.rows.find((row) => row.email === 'testuser_legacy@parle.test')
  if (!userA || !userB) throw new Error('seed users missing')
  const env = {
    ...process.env,
    PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3075',
    PARLE_V2_TEST_STUB: '1',
    TEST_PARLE_SESSION_A: signToken({ id: userA.id, email: userA.email }),
    TEST_PARLE_SESSION_B: signToken({ id: userB.id, email: userB.email }),
    TEST_PARLE_SESSION_LEGACY: userLegacy
      ? signToken({ id: userLegacy.id, email: userLegacy.email })
      : '',
  }
  await db.pool.end().catch(() => {})
  const args = process.argv.slice(2)
  const run = spawnSync(
    process.execPath,
    [path.join('node_modules', '@playwright', 'test', 'cli.js'), 'test', ...args],
    { cwd: path.join(__dirname, '..'), env, encoding: 'utf8', stdio: 'inherit' },
  )
  process.exit(run.status == null ? 1 : run.status)
}

main().catch((error) => {
  console.error(String(error.message || error).slice(0, 200))
  process.exit(1)
})
