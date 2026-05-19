/**
 * Simple NeonDB (Postgres) helper using `pg` Pool.
 * Exports a query function used across API routes.
 */
const { Pool } = require('pg')

const connectionString = process.env.DATABASE_URL

if(!connectionString){
  console.warn('DATABASE_URL not set — DB calls will fail in runtime')
}

const pool = new Pool({ connectionString })

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
}
