export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()
  if (process.env.NODE_ENV === 'production' || String(process.env.AUTH_TEST_MAIL || '') !== '1') {
    return res.status(404).end()
  }
  const email = String(req.query.email || '').trim().toLowerCase()
  const bucket = globalThis.__PARLE_TEST_MAILS || []
  const mails = email ? bucket.filter((item) => String(item.to || '').toLowerCase() === email) : []
  return res.status(200).json({ mails })
}
