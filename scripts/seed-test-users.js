/**
 * Creates or updates audit test accounts in the database.
 * Usage: node scripts/seed-test-users.js
 * Requires DATABASE_URL in environment.
 */
const bcrypt = require('bcryptjs')
const db = require('../lib/db')

const TEST_USERS = [
  { email: 'testuser_a@parle.test', password: 'TestPassword123!' },
  { email: 'testuser_b@parle.test', password: 'TestPassword123!' },
]

async function upsertUser(email, password) {
  const hash = await bcrypt.hash(password, 10)
  const existing = await db.query('SELECT id FROM users WHERE email = $1', [email])
  if (existing.rows.length) {
    await db.query(
      `UPDATE users SET password = $1,
        memory_enabled = COALESCE(memory_enabled, FALSE),
        personalisation_enabled = COALESCE(personalisation_enabled, FALSE),
        training_consent = COALESCE(training_consent, FALSE),
        preferred_name = COALESCE(preferred_name, $2)
       WHERE email = $3`,
      [hash, email.split('@')[0], email],
    )
    return { email, action: 'updated', id: existing.rows[0].id }
  }

  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE)
     RETURNING id`,
    [email, hash, email.split('@')[0]],
  )
  return { email, action: 'created', id: inserted.rows[0].id }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required')
    process.exit(1)
  }

  for (const user of TEST_USERS) {
    try {
      const result = await upsertUser(user.email, user.password)
      console.log(`[seed] ${result.action} ${result.email} (${result.id})`)
    } catch (error) {
      console.error(`[seed] failed for ${user.email}:`, error.message)
      process.exitCode = 1
    }
  }
}

main().finally(() => db.pool.end())
