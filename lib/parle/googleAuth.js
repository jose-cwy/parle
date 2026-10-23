const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { googleEmailTrusted } = require('./authAccess')

const TEST_FLAG = 'AUTH_TEST_GOOGLE'

function googleRedirectUri(env = process.env) {
  const base = String(env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/api/auth/google/callback`
}

function googleAuthUrl({ state, nonce, codeChallenge, env = process.env }) {
  const params = new URLSearchParams({
    client_id: String(env.GOOGLE_CLIENT_ID || ''),
    redirect_uri: googleRedirectUri(env),
    response_type: 'code',
    scope: 'openid email',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'online',
    prompt: 'select_account',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

function pkceVerifier() {
  return crypto.randomBytes(32).toString('base64url')
}

function pkceChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

function isGoogleTestMode(env = process.env) {
  const raw = String(env[TEST_FLAG] || '').trim()
  return raw === '1' || raw === 'true'
}

async function exchangeCode({ code, codeVerifier, env = process.env }) {
  if (isGoogleTestMode(env)) {
    const claims = jwt.verify(String(code || ''), env.JWT_SECRET || 'dev_secret_change_me')
    if (claims.type !== 'google_test') {
      throw new Error('invalid_test_code')
    }
    return {
      id_token: String(code),
      claims,
    }
  }

  const body = new URLSearchParams({
    code: String(code || ''),
    client_id: String(env.GOOGLE_CLIENT_ID || ''),
    client_secret: String(env.GOOGLE_CLIENT_SECRET || ''),
    redirect_uri: googleRedirectUri(env),
    grant_type: 'authorization_code',
    code_verifier: String(codeVerifier || ''),
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const err = new Error('google_token_exchange_failed')
    err.status = res.status
    throw err
  }
  return res.json()
}

async function verifyIdToken({ idToken, nonce, env = process.env }) {
  if (isGoogleTestMode(env)) {
    const claims = jwt.verify(String(idToken || ''), env.JWT_SECRET || 'dev_secret_change_me')
    if (claims.nonce && nonce && claims.nonce !== nonce) {
      throw new Error('nonce_mismatch')
    }
    return claims
  }

  const { OAuth2Client } = require('google-auth-library')
  const client = new OAuth2Client(String(env.GOOGLE_CLIENT_ID || ''))
  const ticket = await client.verifyIdToken({
    idToken,
    audience: String(env.GOOGLE_CLIENT_ID || ''),
  })
  const payload = ticket.getPayload()
  if (!payload) throw new Error('empty_id_token')
  const iss = String(payload.iss || '')
  if (iss !== 'https://accounts.google.com' && iss !== 'accounts.google.com') {
    throw new Error('bad_issuer')
  }
  if (nonce && payload.nonce !== nonce) {
    throw new Error('nonce_mismatch')
  }
  return payload
}

function createTestGoogleCode(claims, env = process.env) {
  return jwt.sign(
    {
      type: 'google_test',
      iss: 'https://accounts.google.com',
      aud: env.GOOGLE_CLIENT_ID || 'test-google-client',
      email_verified: true,
      ...claims,
    },
    env.JWT_SECRET || 'dev_secret_change_me',
    { expiresIn: '10m' },
  )
}

module.exports = {
  TEST_FLAG,
  googleRedirectUri,
  googleAuthUrl,
  pkceVerifier,
  pkceChallenge,
  isGoogleTestMode,
  exchangeCode,
  verifyIdToken,
  googleEmailTrusted,
  createTestGoogleCode,
}
