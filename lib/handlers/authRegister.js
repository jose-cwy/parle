const bcrypt = require('bcryptjs')
const db = require('../db')
const { runApiPipeline, handleApiError } = require('../security/pipeline')
const {
  TERMS_VERSION,
  clearTermsAcceptanceCookie,
  getTermsAcceptanceFromReq,
  signToken,
  setSessionCookie,
} = require('../auth')
const { getRegisterConfigErrors, mapDatabaseError } = require('../serverConfig')
const { sendVerificationEmail } = require('../../utils/resend')

async function handleRegister(req, res) {
  const guard = runApiPipeline(req, res, { tier: 'auth' })
  if (guard.handled) return

  const configErrors = getRegisterConfigErrors()
  if (configErrors.length) {
    console.error('register_config_missing', configErrors.join(', '))
    return res.status(503).json({
      error: `Server configuration incomplete (missing: ${configErrors.join(', ')}).`,
    })
  }

  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' })
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  const acceptedTerms = getTermsAcceptanceFromReq(req)
  if (!acceptedTerms) {
    return res.status(403).json({
      error: 'Please review and accept the terms before creating an account.',
    })
  }

  try {
    const exists = await db.query('SELECT id FROM users WHERE email=$1', [email])
    if (exists.rows.length) return res.status(400).json({ error: 'Email already exists' })

    const hash = await bcrypt.hash(password, 12)
    const now = new Date()
    const result = await db.query(
      `INSERT INTO users (email,password,accepted_terms_at,accepted_terms_version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,email,preferred_name,accepted_terms_at,accepted_terms_version`,
      [email, hash, now, TERMS_VERSION, now, now],
    )
    const token = signToken({ id: result.rows[0].id, email: result.rows[0].email })
    setSessionCookie(res, token)
    clearTermsAcceptanceCookie(res)

    sendVerificationEmail(email).catch((e) => console.warn('Resend error', e))

    return res.status(201).json({ user: result.rows[0] })
  } catch (error) {
    if (error?.code === 'CONFIG_JWT_SECRET') {
      return res.status(503).json({ error: 'Signup is temporarily unavailable. JWT_SECRET is not configured.' })
    }

    const mapped = mapDatabaseError(error)
    if (mapped) {
      const status = error?.code === '23505' ? 400 : 503
      console.error('register_db_error', error?.code, error?.message)
      return res.status(status).json({ error: mapped })
    }

    return handleApiError(res, error, 'register')
  }
}

module.exports = { handleRegister }
