const { loadEnvLocal } = require('./loadEnvLocal')

loadEnvLocal()
if (process.env.REHEARSAL_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.REHEARSAL_DATABASE_URL
}
process.env.PARLE_V2_OPS_CONTROL = '1'
process.env.PARLE_V2_RECOVERY = ''

const {
  loadGenerationControl,
  isV2GenerationBlocked,
} = require('../../lib/parle/v2GenerationControl')

async function main() {
  const snap = await loadGenerationControl({ force: true })
  process.stdout.write(`CACHED:${snap.value}\n`)
  await new Promise((resolve) => {
    process.stdin.once('data', resolve)
  })
  const blocked = await isV2GenerationBlocked()
  process.stdout.write(`BLOCKED:${blocked}\n`)
}

main().catch((error) => {
  process.stderr.write(String(error && error.message ? error.message : error))
  process.exit(1)
})
