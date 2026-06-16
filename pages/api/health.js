export default function handler(req, res) {
  return res.status(200).json({
    ok: true,
    configured: {
      jwt_secret: Boolean(process.env.JWT_SECRET),
      database_url: Boolean(process.env.DATABASE_URL),
      data_encryption_key: Boolean(process.env.DATA_ENCRYPTION_KEY),
      openai_api_key: Boolean(process.env.OPENAI_API_KEY),
    },
  })
}
