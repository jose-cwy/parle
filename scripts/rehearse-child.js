#!/usr/bin/env node
/**
 * Child-branch checks: identity, KEEP table presence after migrate,
 * synthetic encrypt roundtrip. Creates and deletes only a synthetic user
 * on the connected branch. Refuses the primary branch.
 */
const { Client } = require('pg')
const bcrypt = require('bcryptjs')
const { encrypt, decrypt, PREFIX } = require('../lib/security/encryption')
const {
  loadEnvLocal,
  parseRehearsalFlags,
  PRIMARY_BRANCH_ID,
  EXPECTED_PROJECT_ID,
} = require('./rehearsalEnv')

async function main() {
  loadEnvLocal()
  const args = parseRehearsalFlags(process.argv)
  if (!args.rehearsal) {
    console.error('Pass --rehearsal so this script uses REHEARSAL_DATABASE_URL only')
    process.exit(1)
  }
  if (!args.databaseUrl || !args.requireBranch) {
    console.error('Need --rehearsal --require-branch=<child-branch-id>')
    process.exit(1)
  }
  const client = new Client({
    connectionString: args.databaseUrl,
    ssl: { rejectUnauthorized: true },
  })
  await client.connect()
  const ident = await client.query(`
    select current_database() as db,
           current_setting('neon.project_id', true) as project_id,
           current_setting('neon.branch_id', true) as branch_id
  `)
  const row = ident.rows[0]
  console.log(JSON.stringify({ db: row.db, project_id: row.project_id, branch_id: row.branch_id }))
  if (!row.project_id || !row.branch_id) {
    throw new Error('Could not confirm Neon branch identity')
  }
  if (row.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error('Unexpected Neon project')
  }
  if (row.branch_id !== args.requireBranch) {
    throw new Error('Branch identity mismatch')
  }
  if (row.branch_id === PRIMARY_BRANCH_ID) {
    throw new Error('Refusing rehearsal writes on the primary branch')
  }

  const archived = await client.query(`
    select table_name from information_schema.tables
    where table_schema='archive_legacy' order by 1
  `)
  const publicTables = await client.query(`
    select table_name from information_schema.tables
    where table_schema='public' and table_type='BASE TABLE' order by 1
  `)
  console.log('ARCHIVE', archived.rows.map((r) => r.table_name).join(','))
  console.log('PUBLIC', publicTables.rows.map((r) => r.table_name).join(','))

  const email = `rehearse-synth-${Date.now()}@parle.test`
  const hash = await bcrypt.hash('rehearse-synth-pass', 4)
  const inserted = await client.query(
    `INSERT INTO users (email, password, memory_enabled, personalisation_enabled)
     VALUES ($1, $2, TRUE, TRUE) RETURNING id`,
    [email, hash],
  )
  const userId = inserted.rows[0].id
  try {
    const plain = 'synthetic rehearsal payload — not a real user journal'
    const stored = encrypt(plain)
    if (!String(stored).startsWith(PREFIX)) throw new Error('ciphertext missing enc:v1:')
    await client.query('UPDATE users SET last_session_summary = $1 WHERE id = $2', [stored, userId])
    const read = await client.query('SELECT last_session_summary FROM users WHERE id = $1', [userId])
    const back = decrypt(read.rows[0].last_session_summary)
    if (back !== plain) throw new Error('decrypt mismatch')
    console.log('ENCRYPT_ROUNDTRIP=ok')
  } finally {
    await client.query('DELETE FROM users WHERE id = $1', [userId])
  }

  const leftover = await client.query(`SELECT count(*)::int AS n FROM users WHERE email LIKE 'rehearse-synth-%'`)
  console.log('SYNTH_LEFT', leftover.rows[0].n)
  await client.end()
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
