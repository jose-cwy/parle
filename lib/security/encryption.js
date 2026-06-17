const crypto = require('crypto')

const PREFIX = 'enc:v1:'
let warnedMissingKey = false

function normalizeKeyRaw(raw) {
  let value = String(raw ?? '').trim()
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim()
  }
  return value
}

function parseEncryptionKey(raw) {
  const value = normalizeKeyRaw(raw)
  if (!value) return null

  let buf
  try {
    buf = Buffer.from(value, 'base64')
  } catch {
    return null
  }

  if (buf.length !== 32) return null
  return buf
}

function getEncryptionKeyStatus() {
  const raw = process.env.DATA_ENCRYPTION_KEY
  const normalized = normalizeKeyRaw(raw)
  if (!normalized) {
    return { set: false, valid: false, byteLength: 0 }
  }

  let byteLength = 0
  try {
    byteLength = Buffer.from(normalized, 'base64').length
  } catch {
    return { set: true, valid: false, byteLength: 0 }
  }

  return {
    set: true,
    valid: byteLength === 32,
    byteLength,
  }
}

function getKey() {
  const parsed = parseEncryptionKey(process.env.DATA_ENCRYPTION_KEY)
  if (parsed) return parsed

  const status = getEncryptionKeyStatus()
  if (status.set) {
    throw new Error(
      `DATA_ENCRYPTION_KEY must decode to 32 bytes (got ${status.byteLength}). Use a base64 key from: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`,
    )
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

function assertEncryptionConfigured() {
  getKey()
}

function mapEncryptionError(error) {
  const message = String(error?.message || '')
  if (!message.includes('DATA_ENCRYPTION_KEY')) return null

  if (message.includes('must decode to 32 bytes')) {
    return 'Journal encryption key on the server is invalid. In Vercel, set DATA_ENCRYPTION_KEY to a base64 string that decodes to exactly 32 bytes (no quotes).'
  }

  if (message.includes('required in production')) {
    return 'Journal encryption is not configured on the server. Set DATA_ENCRYPTION_KEY in Vercel (32-byte base64 key).'
  }

  return 'Journal encryption key is misconfigured on the server. Check DATA_ENCRYPTION_KEY in Vercel.'
}

module.exports = {
  encrypt,
  decrypt,
  assertEncryptionConfigured,
  getEncryptionKeyStatus,
  mapEncryptionError,
}
