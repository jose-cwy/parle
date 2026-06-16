export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { handleRegister } = await import('../../../lib/handlers/authRegister')
    return handleRegister(req, res)
  } catch (error) {
    console.error('register_bootstrap_error', error)
    return res.status(500).json({
      error: 'Register route failed to start.',
      hint: error?.message || 'Unknown startup error',
    })
  }
}
