export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }
  // Lightweight placeholder for now (validation-stage instrumentation).
  res.status(204).end()
}

