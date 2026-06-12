/**
 * JWT-based session helpers. Uses HttpOnly cookies to store a session token.
 * Keep this simple for V1; replace with more robust session store for V2.
 */
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET === 'dev_secret_change_me')) {
  throw new Error('JWT_SECRET must be set to a strong value in production')
}

const COOKIE_NAME = 'hs_session'
const TERMS_COOKIE_NAME = 'hs_terms_accept'
const TERMS_VERSION = 'heartstrings-safety-v2-2026-05'

function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

function verifyToken(token){
  try{
    return jwt.verify(token, JWT_SECRET)
  }catch(e){
    return null
  }
}

function setSessionCookie(res, token){
  // Set httponly secure cookie
  const isProd = process.env.NODE_ENV === 'production'
  const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; ${isProd ? 'Secure;' : ''} Max-Age=${SESSION_MAX_AGE_SEC}`
  res.setHeader('Set-Cookie', cookie)
}

function clearSessionCookie(res){
  const isProd = process.env.NODE_ENV === 'production'
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; ${isProd ? 'Secure;' : ''} Max-Age=0`)
}

function appendCookie(res, cookie){
  const existing = res.getHeader('Set-Cookie')
  if(!existing){
    res.setHeader('Set-Cookie', [cookie])
    return
  }

  const next = Array.isArray(existing) ? existing : [existing]
  res.setHeader('Set-Cookie', [...next, cookie])
}

function getCookieValue(req, name){
  const cookie = req.headers.cookie || ''
  const match = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(name + '='))
  if(!match) return null
  return match.slice(name.length + 1)
}

function getTokenFromReq(req){
  return getCookieValue(req, COOKIE_NAME)
}

function getSessionPayload(req){
  const token = getTokenFromReq(req)
  if(!token) return null
  return verifyToken(token)
}

function signTermsAcceptanceToken(){
  return jwt.sign({ type: 'terms_acceptance', version: TERMS_VERSION }, JWT_SECRET, { expiresIn: '1d' })
}

function setTermsAcceptanceCookie(res){
  const token = signTermsAcceptanceToken()
  const isProd = process.env.NODE_ENV === 'production'
  appendCookie(
    res,
    `${TERMS_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; ${isProd ? 'Secure;' : ''} Max-Age=${60 * 60 * 24}`
  )
}

function clearTermsAcceptanceCookie(res){
  appendCookie(res, `${TERMS_COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`)
}

function getTermsAcceptanceFromReq(req){
  const token = getCookieValue(req, TERMS_COOKIE_NAME)
  const payload = token ? verifyToken(token) : null

  if(!payload || payload.type !== 'terms_acceptance' || payload.version !== TERMS_VERSION){
    return null
  }

  return payload
}

module.exports = {
  TERMS_VERSION,
  signToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  getTokenFromReq,
  getSessionPayload,
  setTermsAcceptanceCookie,
  clearTermsAcceptanceCookie,
  getTermsAcceptanceFromReq
}
