/**
 * JWT-based session helpers. Uses HttpOnly cookies to store a session token.
 * Keep this simple for V1; replace with more robust session store for V2.
 */
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'
const COOKIE_NAME = 'hs_session'

function signToken(payload){
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
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
  const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; ${isProd? 'Secure;':''} Max-Age=${60*60*24*30}`
  res.setHeader('Set-Cookie', cookie)
}

function clearSessionCookie(res){
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Max-Age=0`) 
}

function getTokenFromReq(req){
  const cookie = req.headers.cookie || ''
  const match = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE_NAME+'='))
  if(!match) return null
  return match.split('=')[1]
}

module.exports = { signToken, verifyToken, setSessionCookie, clearSessionCookie, getTokenFromReq }
