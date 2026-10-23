import bcrypt from 'bcryptjs'
import db from '../../../lib/db'
import {
  signToken,
  setSessionCookie,
  setPendingVerifyCookie,
  clearSessionCookie,
} from '../../../lib/auth'
import { runApiPipeline, handleApiError } from '../../../lib/security/pipeline'
import { normalizeEmail, findUserByEmail } from '../../../lib/parle/authChallenges'
import { isEmailVerified, sessionAllowsApp } from '../../../lib/parle/authAccess'
import { sendOrRefreshVerification } from '../../../lib/parle/sendVerifyMail'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = runApiPipeline(req, res)
  if (guard.handled) return

  try {
    const email = normalizeEmail(req.body?.email)
    const password = req.body?.password
    if (!email || typeof password !== 'string') {
      return res.status(401).json({ error: 'Invalid' })
    }

    const user = await findUserByEmail(email)
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid' })
    }

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Invalid' })

    if (!isEmailVerified(user) && !sessionAllowsApp(user)) {
      await sendOrRefreshVerification({
        userId: user.id,
        email: user.email,
        purpose: 'existing_verify',
      })
      clearSessionCookie(res)
      setPendingVerifyCookie(res, { id: user.id, email: user.email })
      return res.status(403).json({
        ok: false,
        pending: true,
        error: 'check your email to finish signing in.',
      })
    }

    const token = signToken({ id: user.id, email: user.email })
    setSessionCookie(res, token)

    if (!isEmailVerified(user)) {
      await sendOrRefreshVerification({
        userId: user.id,
        email: user.email,
        purpose: 'existing_verify',
      })
    }

    let firstTime = false
    try {
      const hasLetter = await db.query(
        'SELECT 1 FROM letters_to_self WHERE user_id=$1 LIMIT 1',
        [user.id],
      )
      firstTime = hasLetter.rows.length === 0
    } catch {
      /* table may not exist in older schemas — ignore */
    }

    return res.status(200).json({
      ok: true,
      firstTime,
      emailVerified: isEmailVerified(user),
      mustVerify: false,
    })
  } catch (error) {
    if (error?.code === '42703') {
      return handleLegacyLogin(req, res)
    }
    return handleApiError(res, error, 'login')
  }
}

async function handleLegacyLogin(req, res) {
  const { email, password } = req.body || {}
  const user = await db.query('SELECT id,email,password FROM users WHERE email=$1', [email])
  if (!user.rows.length) return res.status(401).json({ error: 'Invalid' })
  const u = user.rows[0]
  const ok = await bcrypt.compare(password, u.password)
  if (!ok) return res.status(401).json({ error: 'Invalid' })
  const token = signToken({ id: u.id, email: u.email })
  setSessionCookie(res, token)
  return res.status(200).json({ ok: true, emailVerified: false, legacy: true })
}
