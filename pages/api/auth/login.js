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
import { isEmailVerified, isLegacyUnverified, sessionAllowsApp } from '../../../lib/parle/authAccess'
import { isAuthSchemaError, loginResponseForSchemaError } from '../../../lib/parle/authSchemaFallback'
import { sendOrRefreshVerification } from '../../../lib/parle/sendVerifyMail'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const guard = await runApiPipeline(req, res)
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
      try {
        await sendOrRefreshVerification({
          userId: user.id,
          email: user.email,
          purpose: 'existing_verify',
        })
      } catch (error) {
        if (isAuthSchemaError(error)) {
          clearSessionCookie(res)
          const decision = loginResponseForSchemaError()
          return res.status(decision.status).json(decision.body)
        }
        throw error
      }
      clearSessionCookie(res)
      setPendingVerifyCookie(res, { id: user.id, email: user.email })
      return res.status(403).json({
        ok: false,
        pending: true,
        lockout: isLegacyUnverified(user),
        error: 'check your email to finish signing in.',
      })
    }

    const token = signToken({ id: user.id, email: user.email })
    setSessionCookie(res, token)

    if (!isEmailVerified(user)) {
      try {
        await sendOrRefreshVerification({
          userId: user.id,
          email: user.email,
          purpose: 'existing_verify',
        })
      } catch {
        /* Authorized legacy login must not be revoked if mail/schema side-effects fail. */
      }
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
    if (isAuthSchemaError(error)) {
      clearSessionCookie(res)
      const decision = loginResponseForSchemaError()
      return res.status(decision.status).json(decision.body)
    }
    return handleApiError(res, error, 'login')
  }
}
