import { runApiPipeline } from '../../lib/security/pipeline'

const CLIENT_ALLOWED = new Set(['chat_loaded', 'entry_started', 'chat_title_auto', 'chat_deleted', 'chat_perf'])

export default async function handler(req, res) {
  const guard = await runApiPipeline(req, res, { tier: 'default' })
  if (guard.handled) return

  if (req.method !== 'POST') {
    res.status(405).end()
    return
  }

  const name = String(req.body?.event || '').trim()
  if (!CLIENT_ALLOWED.has(name)) {
    res.status(204).end()
    return
  }

  res.status(204).end()
}
