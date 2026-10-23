/**
 * JWT-based session helpers. Uses HttpOnly cookies to store a session token.
 * Keep this simple for V1; replace with more robust session store for V2.
 */
const jwt = require('jsonwebtoken')
const { TERMS_VERSION } = require('./termsVersion')

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7
const DEV_JWT_SECRET = 'dev_secret_change_me'

const COOKIE_NAME = 'hs_session'
const TERMS_COOKIE_NAME = 'hs_terms_accept'
const OAUTH_COOKIE_NAME = 'hs_oauth'
const PENDING_COOKIE_NAME = 'hs_verify_pending'
const GOOGLE_PENDING_COOKIE_NAME = 'hs_google_pending'
const OAUTH_MAX_AGE_SEC = 60 * 10
const PENDING_MAX_AGE_SEC = 60 * 60 * 24

function resolveJwtSecret() {
  const secret = process.env.JWT_SECRET || DEV_JWT_SECRET
  if (
    process.env.NODE_ENV === 'production'
    && (!process.env.JWT_SECRET || secret === DEV_JWT_SECRET)
  ) {
    return null
  }
  return secret
}

function assertJwtSecret() {
  const secret = resolveJwtSecret()
  if (!secret) {
    const err = new Error('JWT_SECRET must be set to a strong value in production')
    err.code = 'CONFIG_JWT_SECRET'
    throw err
  }
  return secret
}

function signToken(payload) {
  return jwt.sign(payload, assertJwtSecret(), { expiresIn: '7d' })
}

function verifyToken(token) {
  const secret = resolveJwtSecret()
  if (!secret) return null
  try {
    return jwt.verify(token, secret)
  } catch {
    return null
  }
}

function cookieFlags(maxAgeSec) {
  const isProd = process.env.NODE_ENV === 'production'
  return `Path=/; HttpOnly; SameSite=Lax; ${isProd ? 'Secure; ' : ''}Max-Age=${maxAgeSec}`
}

function setSessionCookie(res, token) {
  appendCookie(res, `${COOKIE_NAME}=${token}; ${cookieFlags(SESSION_MAX_AGE_SEC)}`)
}

function clearSessionCookie(res) {
  appendCookie(res, `${COOKIE_NAME}=; ${cookieFlags(0)}`)
}

function appendCookie(res, cookie) {
  const existing = res.getHeader('Set-Cookie')
  if (!existing) {
    res.setHeader('Set-Cookie', [cookie])
    return
  }

  const next = Array.isArray(existing) ? existing : [existing]
  res.setHeader('Set-Cookie', [...next, cookie])
}

function getCookieValue(req, name) {
  const cookie = req.headers.cookie || ''
  const match = cookie.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${name}=`))
  if (!match) return null
  return match.slice(name.length + 1)
}

function getTokenFromReq(req) {
  return getCookieValue(req, COOKIE_NAME)
}

function getSessionPayload(req) {
  const token = getTokenFromReq(req)
  if (!token) return null
  return verifyToken(token)
}

function signTermsAcceptanceToken() {
  return jwt.sign(
    { type: 'terms_acceptance', version: TERMS_VERSION },
    assertJwtSecret(),
    { expiresIn: '1d' },
  )
}

function setTermsAcceptanceCookie(res) {
  const token = signTermsAcceptanceToken()
  const isProd = process.env.NODE_ENV === 'production'
  appendCookie(
    res,
    `${TERMS_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; ${isProd ? 'Secure;' : ''} Max-Age=${60 * 60 * 24}`,
  )
}

function clearTermsAcceptanceCookie(res) {
  appendCookie(res, `${TERMS_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`)
}

function getTermsAcceptanceFromReq(req) {
  const token = getCookieValue(req, TERMS_COOKIE_NAME)
  const payload = token ? verifyToken(token) : null

  if (!payload || payload.type !== 'terms_acceptance' || payload.version !== TERMS_VERSION) {
    return null
  }

  return payload
}

function setTypedCookie(res, name, payload, maxAgeSec, expiresIn) {
  const token = jwt.sign(payload, assertJwtSecret(), { expiresIn })
  appendCookie(res, `${name}=${token}; ${cookieFlags(maxAgeSec)}`)
}

function clearNamedCookie(res, name) {
  appendCookie(res, `${name}=; ${cookieFlags(0)}`)
}

function readTypedCookie(req, name, type) {
  const token = getCookieValue(req, name)
  const payload = token ? verifyToken(token) : null
  if (!payload || payload.type !== type) return null
  return payload
}

function setOauthCookie(res, payload) {
  setTypedCookie(
    res,
    OAUTH_COOKIE_NAME,
    { type: 'oauth', ...payload },
    OAUTH_MAX_AGE_SEC,
    '10m',
  )
}

function clearOauthCookie(res) {
  clearNamedCookie(res, OAUTH_COOKIE_NAME)
}

function getOauthFromReq(req) {
  return readTypedCookie(req, OAUTH_COOKIE_NAME, 'oauth')
}

function setPendingVerifyCookie(res, { id, email }) {
  setTypedCookie(
    res,
    PENDING_COOKIE_NAME,
    { type: 'verify_pending', id, email },
    PENDING_MAX_AGE_SEC,
    '1d',
  )
}

function clearPendingVerifyCookie(res) {
  clearNamedCookie(res, PENDING_COOKIE_NAME)
}

function getPendingVerifyFromReq(req) {
  return readTypedCookie(req, PENDING_COOKIE_NAME, 'verify_pending')
}

function setGooglePendingCookie(res, payload) {
  setTypedCookie(
    res,
    GOOGLE_PENDING_COOKIE_NAME,
    { type: 'google_pending', ...payload },
    OAUTH_MAX_AGE_SEC,
    '10m',
  )
}

function clearGooglePendingCookie(res) {
  clearNamedCookie(res, GOOGLE_PENDING_COOKIE_NAME)
}

function getGooglePendingFromReq(req) {
  return readTypedCookie(req, GOOGLE_PENDING_COOKIE_NAME, 'google_pending')
}

module.exports = {
  TERMS_VERSION,
  COOKIE_NAME,
  signToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  getTokenFromReq,
  getSessionPayload,
  setTermsAcceptanceCookie,
  clearTermsAcceptanceCookie,
  getTermsAcceptanceFromReq,
  setOauthCookie,
  clearOauthCookie,
  getOauthFromReq,
  setPendingVerifyCookie,
  clearPendingVerifyCookie,
  getPendingVerifyFromReq,
  setGooglePendingCookie,
  clearGooglePendingCookie,
  getGooglePendingFromReq,
  appendCookie,
}
