#!/usr/bin/env node
async function probe(url, init) {
  const res = await fetch(url, init)
  const body = await res.text()
  let error = ''
  try {
    error = String(JSON.parse(body).error || '')
  } catch {
    error = ''
  }
  console.log(
    JSON.stringify({
      method: init.method,
      status: res.status,
      error,
      vercelIdCell: String(res.headers.get('x-vercel-id') || '').split('::')[0] || '',
    }),
  )
}

async function main() {
  const path = 'https://parle.chat/api/cron/guest-email-followups'
  await probe(path, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer rehearsal-unauth-probe',
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
