const crypto = require('crypto')

const PREFIX = 'enc:v1:'
let warnedMissingKey = false

function getKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY
  if (raw) {
    const buf = Buffer.from(raw, 'base64')
    if (buf.length !== 32) {
      throw new Error('DATA_ENCRYPTION_KEY must be 32 bytes (base64-encoded)')
    }
    return buf
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DATA_ENCRYPTION_KEY is required in production')
  }

  if (!warnedMissingKey) {
    console.warn('[security] DATA_ENCRYPTION_KEY not set — using dev-only derived key')
    warnedMissingKey = true
  }

  return crypto
    .createHash('sha256')
    .update(process.env.JWT_SECRET || 'dev_secret_change_me')
    .digest()
}

function encrypt(plaintext) {
  const text = String(plaintext ?? '')
  if (!text) return text

  const key = getKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

function decrypt(stored) {
  const value = String(stored ?? '')
  if (!value) return value
  if (!value.startsWith(PREFIX)) return value

  const key = getKey()
  const payload = value.slice(PREFIX.length)
  const [ivB64, tagB64, dataB64] = payload.split(':')
  if (!ivB64 || !tagB64 || !dataB64) return value

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64'),
    )
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'))
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ])
    return decrypted.toString('utf8')
  } catch (error) {
    console.error('[security] decrypt_failed', error?.message)
    return ''
  }
}

module.exports = {
  encrypt,
  decrypt,
}
