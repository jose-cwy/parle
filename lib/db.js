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

const connectionString = connectionStringWithVerifyFull(process.env.DATABASE_URL)

if(!connectionString){
  console.warn('DATABASE_URL not set — DB calls will fail in runtime')
}

const pool = new Pool({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 8000,
  idleTimeoutMillis: 10000,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: true }
      : process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: true }
        : false,
})

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
}
module.exports.default = module.exports
