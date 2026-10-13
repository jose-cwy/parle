/**
 * Simple NeonDB (Postgres) helper using `pg` Pool.
 * Exports a query function used across API routes.
 */
const { Pool } = require('pg')

function connectionStringWithVerifyFull(connectionString) {
  if (!connectionString) return connectionString
  try {
    const parsed = new URL(connectionString)
    const mode = parsed.searchParams.get('sslmode')
    if (mode === 'prefer' || mode === 'require' || mode === 'verify-ca') {
      parsed.searchParams.set('sslmode', 'verify-full')
    }
    return parsed.toString()
  } catch {
    return connectionString.replace(
      /([?&]sslmode=)(require|prefer|verify-ca)\b/i,
      '$1verify-full',
    )
  }
}

const connectionString = connectionStringWithVerifyFull(process.env.DATABASE_URL)

if(!connectionString){
  console.warn('DATABASE_URL not set — DB calls will fail in runtime')
}

const pool = new Pool({
  connectionString,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: true }
      : process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: true }
        : false,
})

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
}
