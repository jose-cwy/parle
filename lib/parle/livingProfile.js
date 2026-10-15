const db = require('../db')
const { encrypt, decrypt } = require('../security/encryption')
const { getUserSettings } = require('./userSettings')
const { openaiChatComplete } = require('../openai')
const {
  emptyProfile,
  fadeAndCap,
  overlayPreferenceKnobs,
  mergeSessionSignals,
  mergeFeedbackSignals,
  mergeExtractedFacts,
  toPublicItems,
  deleteFactById,
} = require('./livingProfileCore')

let schemaReady = null

const EXTRACT_PROMPT = `Extract ONLY what the user explicitly said. Return JSON with keys:
people: string[] (names or roles they used, e.g. "my ex", "Jia Hui")
stage: string or null (relationship stage in their words)
timeline: string or null (timing they stated)
direction: string or null (how they said things have been going)
patterns: string[] (behaviour they described, not diagnoses)
contradictedKeys: string[] (optional keys this chat clearly contradicts, e.g. "situation:stage")

Never infer mental or physical health, diagnoses, sexual details, or anyone's inner life beyond the user's words.
If unsure, omit. JSON only.`

async function ensureLivingProfileSchema() {
  if (!schemaReady) {
    schemaReady = db
      .query(`
        CREATE TABLE IF NOT EXISTS user_living_profile (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          payload TEXT NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `)
      .catch((error) => {
        console.error('living_profile_schema_error', error?.message)
      })
  }
  return schemaReady
}

function serializeProfile(profile) {
  return encrypt(JSON.stringify(fadeAndCap(profile)))
}

function deserializeProfile(stored) {
  const raw = decrypt(stored)
  if (!raw) return emptyProfile()
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return emptyProfile()
    return fadeAndCap({
      ...emptyProfile(),
      ...parsed,
      facts: Array.isArray(parsed.facts) ? parsed.facts : [],
    })
  } catch {
    return emptyProfile()
  }
}

async function loadLivingProfile(userId) {
  if (!userId) return null
  await ensureLivingProfileSchema()
  const result = await db.query(
    'SELECT payload FROM user_living_profile WHERE user_id = $1',
    [userId],
  )
  if (!result.rows[0]?.payload) return emptyProfile()
  return deserializeProfile(result.rows[0].payload)
}

async function saveLivingProfile(userId, profile) {
  if (!userId) return
  await ensureLivingProfileSchema()
  const payload = serializeProfile(profile)
  await db.query(
    `INSERT INTO user_living_profile (user_id, payload, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
    [userId, payload],
  )
}

async function resetLivingProfile(userId) {
  if (!userId) return
  await ensureLivingProfileSchema()
  await db.query('DELETE FROM user_living_profile WHERE user_id = $1', [userId])
}

async function extractFactsFromTranscript(transcript) {
  const text = String(transcript || '').trim().slice(0, 4000)
  if (!text) return {}
  try {
    const raw = await openaiChatComplete({
      messages: [
        { role: 'system', content: EXTRACT_PROMPT },
        { role: 'user', content: text },
      ],
      temperature: 0.1,
    })
    const json = String(raw || '').replace(/^```json\s*|\s*```$/g, '')
    const parsed = JSON.parse(json)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function updateLivingProfileAfterSession(userId, { signals, transcript, hour, feedbackRows } = {}) {
  if (!userId) return null
  const settings = await getUserSettings(userId)
  if (!settings.personalisation_enabled) return null

  let profile = await loadLivingProfile(userId)
  profile = mergeSessionSignals(profile, signals, hour)
  profile = mergeFeedbackSignals(profile, feedbackRows)
  if (transcript) {
    const extracted = await extractFactsFromTranscript(transcript)
    profile = mergeExtractedFacts(profile, extracted)
  }
  await saveLivingProfile(userId, profile)
  return profile
}

async function getLivingProfileForUser(userId, { personalisationEnabled } = {}) {
  if (!userId) return null
  const enabled =
    typeof personalisationEnabled === 'boolean'
      ? personalisationEnabled
      : Boolean((await getUserSettings(userId)).personalisation_enabled)
  if (!enabled) return null
  try {
    return await loadLivingProfile(userId)
  } catch {
    return null
  }
}

async function getPublicLivingProfile(userId) {
  if (!userId) return { groups: [] }
  const profile = await loadLivingProfile(userId)
  return { groups: toPublicItems(profile || emptyProfile()) }
}

async function deleteLivingProfileFact(userId, factId) {
  if (!userId || !factId) return { groups: [] }
  const profile = await loadLivingProfile(userId)
  const next = deleteFactById(profile || emptyProfile(), factId)
  await saveLivingProfile(userId, next)
  return { groups: toPublicItems(next) }
}

module.exports = {
  ensureLivingProfileSchema,
  serializeProfile,
  deserializeProfile,
  loadLivingProfile,
  saveLivingProfile,
  resetLivingProfile,
  extractFactsFromTranscript,
  updateLivingProfileAfterSession,
  getLivingProfileForUser,
  getPublicLivingProfile,
  deleteLivingProfileFact,
  overlayPreferenceKnobs,
}
