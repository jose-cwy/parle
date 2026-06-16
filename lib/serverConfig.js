function missingEnv(name) {
  const value = process.env[name]
  return !value || !String(value).trim()
}

function getRegisterConfigErrors() {
  const errors = []
  if (missingEnv('JWT_SECRET') || process.env.JWT_SECRET === 'dev_secret_change_me') {
    errors.push('JWT_SECRET')
  }
  if (missingEnv('DATABASE_URL')) {
    errors.push('DATABASE_URL')
  }
  return errors
}

function mapDatabaseError(error) {
  const code = error?.code
  const message = String(error?.message || '')

  if (code === '42P01') {
    return 'Database tables are missing. Run database/schema.sql on your Neon database.'
  }
  if (code === '42703') {
    return 'Database is missing required columns. Re-run database/schema.sql and database/parle_chat.sql.'
  }
  if (code === '23505') {
    return 'Email already exists'
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT') {
    return 'Cannot reach the database. Check DATABASE_URL (use Neon pooled URL with ?sslmode=require).'
  }
  if (message.includes('SSL') || message.includes('certificate')) {
    return 'Database SSL connection failed. Use Neon connection string with ?sslmode=require.'
  }
  if (message.includes('password authentication failed')) {
    return 'Database login failed. Check DATABASE_URL username and password.'
  }
  return null
}

module.exports = {
  getRegisterConfigErrors,
  mapDatabaseError,
}
