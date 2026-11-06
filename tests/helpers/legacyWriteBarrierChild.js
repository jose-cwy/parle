const { loadEnvLocal } = require('./loadEnvLocal')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}

const db = require('../../lib/db')
const { insertChatMessage } = require('../../lib/chatMemoryDb')
const { lockBarrierRow } = require('../../lib/parle/legacyWriteBarrier')

async function main() {
  const mode = process.argv[2] || 'insert'
  const userId = process.env.BARRIER_USER_ID
  if (!userId) throw new Error('BARRIER_USER_ID missing')

  if (mode === 'delayed-commit') {
    const client = await db.pool.connect()
    try {
      await client.query('BEGIN')
      const state = await lockBarrierRow((text, params) => client.query(text, params))
      process.stdout.write(`LOCKED:${state.frozen ? 'frozen' : 'live'}\n`)
      await new Promise((resolve) => {
        process.stdin.once('data', resolve)
      })
      if (state.frozen) {
        await client.query('ROLLBACK')
        process.stdout.write('INSERTED:0\n')
        return
      }
      await client.query(
        `INSERT INTO chat_memory (user_id, role, text, training_content, created_at)
         VALUES ($1, 'user', $2, $2, now())`,
        [userId, 'enc:v1:delayed-commit-marker'],
      )
      await client.query('COMMIT')
      process.stdout.write('INSERTED:1\n')
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      process.stdout.write(`INSERTED:0:${error.body?.error || error.message}\n`)
    } finally {
      client.release()
    }
    return
  }

  try {
    await insertChatMessage(userId, 'user', `child-insert-${Date.now()}`)
    process.stdout.write('INSERTED:1\n')
  } catch (error) {
    process.stdout.write(`INSERTED:0:${error.body?.error || error.message}\n`)
  }
}

main().catch((error) => {
  process.stderr.write(String(error && error.message ? error.message : error))
  process.exit(1)
})
