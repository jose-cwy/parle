/**
 * Re-align entry_date with created_at local calendar day (run once if dates are off).
 */
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eq = trimmed.indexOf('=')
      if (eq === -1) return
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) process.env[key] = val
    })
}

function localDateKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function main() {
  loadEnvLocal()
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL missing')
    process.exit(1)
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const { rows } = await pool.query(
      'SELECT id, created_at, entry_date FROM diary WHERE entry_date IS NOT NULL',
    )
    let updated = 0
    for (const row of rows) {
      const key = localDateKey(row.created_at)
      const current =
        row.entry_date instanceof Date
          ? `${row.entry_date.getUTCFullYear()}-${String(row.entry_date.getUTCMonth() + 1).padStart(2, '0')}-${String(row.entry_date.getUTCDate()).padStart(2, '0')}`
          : String(row.entry_date).slice(0, 10)
      if (key !== current) {
        await pool.query('UPDATE diary SET entry_date = $1::date WHERE id = $2', [key, row.id])
        updated += 1
        console.log(`Fixed entry ${row.id}: ${current} → ${key}`)
      }
    }
    console.log(`Done. Updated ${updated} row(s).`)
  } finally {
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
