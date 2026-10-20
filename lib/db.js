/**
 * Simple NeonDB (Postgres) helper using `pg` Pool.
 * Exports a query function used across API routes.
 */
const { Pool } = require('pg')

function connectionStringWithVerifyFull(connectionString) {
  if (!connectionString) return connectionString
  return String(connectionString).replace(
    /([?&]sslmode=)(require|prefer|verify-ca)\b/i,
    '$1verify-full',
  )
}

let pool = null

function getPool() {
  if (pool) return pool

  const connectionString = connectionStringWithVerifyFull(process.env.DATABASE_URL)
  if (!connectionString) {
    console.warn('DATABASE_URL not set — DB calls will fail in runtime')
  }

  const wantsSsl = /sslmode=(require|verify-full|verify-ca)/i.test(String(connectionString || ''))
    || /neon\.tech/i.test(String(connectionString || ''))

  pool = new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 10000,
    ssl:
      process.env.NODE_ENV === 'production'
      || process.env.DATABASE_SSL === 'true'
      || wantsSsl
        ? { rejectUnauthorized: true }
        : false,
  })
  return pool
}

module.exports = {
  query: (text, params) => getPool().query(text, params),
  get pool() {
    return getPool()
  },
}
module.exports.default = module.exports
