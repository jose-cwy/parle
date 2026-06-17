import { getEncryptionKeyStatus } from '../../lib/security/encryption'

export default function handler(req, res) {
  const encryption = getEncryptionKeyStatus()

  return res.status(200).json({
    ok: true,
    configured: {
      jwt_secret: Boolean(process.env.JWT_SECRET),
      database_url: Boolean(process.env.DATABASE_URL),
      data_encryption_key: encryption.set,
      data_encryption_key_valid: encryption.valid,
      openai_api_key: Boolean(process.env.OPENAI_API_KEY),
    },
    encryption_key_bytes: encryption.set ? encryption.byteLength : null,
  })
}
