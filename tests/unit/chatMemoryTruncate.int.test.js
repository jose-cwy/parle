const test = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { loadEnvLocal } = require('../helpers/loadEnvLocal')

loadEnvLocal()

const db = require('../../lib/db')
const { insertChatMessage, listChatMessages } = require('../../lib/chatMemoryDb')
const { applyChatMemoryEditTruncate } = require('../../lib/parle/chatMemory')

const SYNTH_EMAIL = `edit-keep-${Date.now()}@parle.test`

test('edit/resend no-op keeps unrelated conversation markers and row ids', async (t) => {
  if (!process.env.DATABASE_URL) {
    t.skip('DATABASE_URL is not set')
    return
  }

  const ident = await db.query(`SELECT current_setting('neon.branch_id', true) AS branch_id`)
  if (ident.rows[0]?.branch_id !== 'br-square-unit-apbswjj3') {
    t.skip('requires rehearsal child br-square-unit-apbswjj3')
    return
  }

  const password = await bcrypt.hash('edit-keep-pass', 4)
  const inserted = await db.query(
    `INSERT INTO users (email, password, preferred_name, memory_enabled, personalisation_enabled, training_consent, email_verified_at)
     VALUES ($1, $2, $3, FALSE, FALSE, FALSE, now())
     RETURNING id`,
    [SYNTH_EMAIL, password, 'edit-keep'],
  )
  const userId = inserted.rows[0].id

  try {
    await insertChatMessage(userId, 'user', 'CONV-B bakery on orchard marker')
    await insertChatMessage(userId, 'assistant', 'CONV-B bakery reply marker')
    await insertChatMessage(userId, 'user', 'CONV-C rainy bus ride marker')
    await insertChatMessage(userId, 'assistant', 'CONV-C bus reply marker')
    await insertChatMessage(userId, 'user', 'CONV-A fictional umbrella marker')
    await insertChatMessage(userId, 'assistant', 'CONV-A umbrella reply marker')

    const before = await listChatMessages(userId, { limit: 50, order: 'ASC' })
    assert.equal(before.length, 6)
    const beforeIds = before.map((row) => row.id)

    const first = await applyChatMemoryEditTruncate(userId, { isEdit: true, dropTrailing: 40 })
    const retry = await applyChatMemoryEditTruncate(userId, { isEdit: true, dropTrailing: 40 })
    assert.equal(first.applied, false)
    assert.equal(retry.applied, false)

    const after = await listChatMessages(userId, { limit: 50, order: 'ASC' })
    assert.equal(after.length, 6)
    assert.deepEqual(after.map((row) => row.id), beforeIds)
    const blob = JSON.stringify(after)
    assert.match(blob, /CONV-B bakery/)
    assert.match(blob, /CONV-C rainy bus/)
    assert.match(blob, /CONV-A fictional umbrella/)
  } finally {
    await db.query('DELETE FROM chat_memory WHERE user_id = $1', [userId])
    await db.query('DELETE FROM users WHERE id = $1', [userId])
  }
})
