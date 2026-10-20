#!/usr/bin/env node
/**
 * Create a Neon child branch of the audited primary.
 * Requires NEON_API_KEY (never logged).
 */
const PROJECT_ID = 'little-truth-88273418'
const PARENT_BRANCH_ID = 'br-morning-sun-apghun9g'

async function main() {
  const token = String(process.env.NEON_API_KEY || process.env.NEON_API_TOKEN || '').trim()
  if (!token) {
    console.error('NEON_API_KEY is not set. Create a child branch in the Neon console from parent br-morning-sun-apghun9g, then pass its branch id to migrate.js.')
    process.exit(2)
  }
  const name = process.argv[2] || `schema-rehearse-${Date.now()}`
  const res = await fetch(`https://console.neon.tech/api/v2/projects/${PROJECT_ID}/branches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch: {
        name,
        parent_id: PARENT_BRANCH_ID,
      },
      endpoints: [{ type: 'read_write' }],
    }),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('Neon API error', res.status, text.slice(0, 400))
    process.exit(1)
  }
  const payload = JSON.parse(text)
  const branch = payload.branch || {}
  const endpoint = (payload.endpoints && payload.endpoints[0]) || {}
  console.log(
    JSON.stringify({
      branch_id: branch.id,
      branch_name: branch.name,
      parent_id: branch.parent_id,
      endpoint_id: endpoint.id,
      host: endpoint.host,
    }),
  )
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
