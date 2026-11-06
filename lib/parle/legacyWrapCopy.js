const db = require('../db')
const { encrypt, PREFIX } = require('../security/encryption')

const WRAP_TITLE = 'Earlier conversations'
const WRAP_IMPORT_KEY = 'chat_memory:v1'
const BATCH_SIZE = 50
const LOCK_KEY_A = 872451902

function copyCiphertext(stored) {
  const value = String(stored ?? '')
  if (!value) return value
  if (value.startsWith(PREFIX)) return value
  return encrypt(value)
}

function normalizeRole(role) {
  const value = String(role || '')
  if (value === 'user' || value === 'assistant' || value === 'system') return value
  throw new Error('unsupported_legacy_role')
}

async function nextSeq(client, conversationId) {
  const result = await client.query(
    `SELECT COALESCE(MAX(seq), 0) + 1 AS seq
     FROM conversation_messages
     WHERE conversation_id = $1`,
    [conversationId],
  )
  return Number(result.rows[0].seq)
}

async function ensureWrapConversation(client, userId) {
  const existing = await client.query(
    `SELECT * FROM conversations
     WHERE user_id = $1 AND origin = 'legacy_timeline'
     LIMIT 1`,
    [userId],
  )
  if (existing.rows[0]) return existing.rows[0]
  try {
    const inserted = await client.query(
      `INSERT INTO conversations
        (user_id, status, title_enc, origin, legacy_import_key, mode_id)
       VALUES ($1, 'archived', $2, 'legacy_timeline', $3, 'cross')
       RETURNING *`,
      [userId, encrypt(WRAP_TITLE), WRAP_IMPORT_KEY],
    )
    return inserted.rows[0]
  } catch (error) {
    if (error && error.code === '23505') {
      const again = await client.query(
        `SELECT * FROM conversations
         WHERE user_id = $1 AND origin = 'legacy_timeline'
         LIMIT 1`,
        [userId],
      )
      if (again.rows[0]) return again.rows[0]
    }
    throw error
  }
}

async function countUnmapped(client, userId) {
  const result = await client.query(
    `SELECT COUNT(*)::bigint AS n
     FROM chat_memory m
     WHERE m.user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM conversation_legacy_map map
         WHERE map.user_id = m.user_id AND map.chat_memory_id = m.id
       )`,
    [userId],
  )
  return Number(result.rows[0].n)
}

async function mappedCount(client, userId) {
  const result = await client.query(
    `SELECT COUNT(*)::bigint AS n FROM conversation_legacy_map WHERE user_id = $1`,
    [userId],
  )
  return Number(result.rows[0].n)
}

async function resequenceWrap(client, userId, wrapId) {
  await client.query(
    `WITH ordered AS (
       SELECT dest.id,
              ROW_NUMBER() OVER (ORDER BY m.created_at ASC, m.id ASC) AS new_seq
       FROM conversation_legacy_map map
       JOIN chat_memory m
         ON m.id = map.chat_memory_id AND m.user_id = map.user_id
       JOIN conversation_messages dest
         ON dest.id = map.conversation_message_id
        AND dest.conversation_id = map.conversation_id
       WHERE map.user_id = $1 AND map.conversation_id = $2
     )
     UPDATE conversation_messages d
        SET seq = ordered.new_seq + 1000000000
       FROM ordered
      WHERE d.id = ordered.id`,
    [userId, wrapId],
  )
  await client.query(
    `UPDATE conversation_messages
        SET seq = seq - 1000000000
      WHERE conversation_id = $1 AND seq >= 1000000000`,
    [wrapId],
  )
}

async function markInterrupted(userId, message) {
  await db.query(
    `INSERT INTO user_chat_migration (user_id, state, error, updated_at)
     VALUES ($1, 'interrupted', $2, now())
     ON CONFLICT (user_id) DO UPDATE
       SET state = 'interrupted',
           error = EXCLUDED.error,
           finished_at = NULL,
           updated_at = now()`,
    [userId, String(message || 'interrupted').slice(0, 500)],
  )
}

async function wrapUserLegacyTimeline(userId, options = {}) {
  const batchSize = Math.max(1, Number(options.batchSize) || BATCH_SIZE)
  const maxBatches = Number.isFinite(options.maxBatches) ? options.maxBatches : Infinity
  const writesQuiesced = Boolean(options.writesQuiesced)
  const failBeforeCommit = Boolean(options.failBeforeCommit)
  const onAfterBatch = options.onAfterBatch

  const client = await db.pool.connect()
  let batches = 0
  let copiedThisRun = 0
  let lastState = null
  let wrapId = null

  try {
    while (batches < maxBatches) {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2::text))', [
        LOCK_KEY_A,
        String(userId),
      ])

      await client.query(
        `INSERT INTO user_chat_migration (user_id, state, started_at, updated_at)
         VALUES ($1, 'migrating', now(), now())
         ON CONFLICT (user_id) DO UPDATE
           SET state = 'migrating',
               started_at = COALESCE(user_chat_migration.started_at, now()),
               error = NULL,
               finished_at = NULL,
               updated_at = now()`,
        [userId],
      )
      await client.query(
        `SELECT user_id FROM user_chat_migration WHERE user_id = $1 FOR UPDATE`,
        [userId],
      )

      const wrap = await ensureWrapConversation(client, userId)
      wrapId = wrap.id
      await client.query(
        `UPDATE user_chat_migration
         SET wrap_conversation_id = $2, updated_at = now()
         WHERE user_id = $1`,
        [userId, wrap.id],
      )

      const snapshot = await client.query(
        `SELECT pg_current_snapshot()::text AS snap,
                pg_snapshot_xmin(pg_current_snapshot())::text AS xmin,
                clock_timestamp() AS at`,
      )

      const unmapped = await client.query(
        `SELECT m.id, m.role, m.text, m.training_content, m.created_at
         FROM chat_memory m
         WHERE m.user_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM conversation_legacy_map map
             WHERE map.user_id = m.user_id AND map.chat_memory_id = m.id
           )
         ORDER BY m.created_at ASC, m.id ASC
         LIMIT $2
         FOR SHARE OF m`,
        [userId, batchSize],
      )

      for (const row of unmapped.rows) {
        const seq = await nextSeq(client, wrap.id)
        const inserted = await client.query(
          `INSERT INTO conversation_messages
            (conversation_id, user_id, role, seq, text_enc, training_content_enc, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            wrap.id,
            userId,
            normalizeRole(row.role),
            seq,
            copyCiphertext(row.text),
            row.training_content ? copyCiphertext(row.training_content) : null,
            row.created_at,
          ],
        )
        await client.query(
          `INSERT INTO conversation_legacy_map
            (user_id, chat_memory_id, conversation_id, conversation_message_id)
           VALUES ($1, $2, $3, $4)`,
          [userId, row.id, wrap.id, inserted.rows[0].id],
        )
      }

      if (failBeforeCommit) {
        throw new Error('injected_txn_failure')
      }

      const remaining = await countUnmapped(client, userId)
      const mapped = await mappedCount(client, userId)
      let state = 'migrating'
      if (remaining === 0) {
        state = writesQuiesced ? 'migrated' : 'pending_quiesce'
      }

      if (unmapped.rows.length) {
        await resequenceWrap(client, userId, wrap.id)
      }

      await client.query(
        `UPDATE conversations
         SET last_message_at = (
               SELECT MAX(created_at) FROM conversation_messages WHERE conversation_id = $1
             ),
             updated_at = now(),
             timeline_revision = CASE
               WHEN $3::int > 0 THEN COALESCE(timeline_revision, 0) + 1
               ELSE COALESCE(timeline_revision, 0)
             END
         WHERE id = $1 AND user_id = $2`,
        [wrap.id, userId, unmapped.rows.length],
      )

      await client.query(
        `UPDATE user_chat_migration
         SET state = $2,
             wrap_conversation_id = $3,
             snapshot_xmin = $4,
             snapshot_at = $5,
             last_batch_at = now(),
             mapped_count = $6,
             finished_at = CASE WHEN $2 = 'migrated' THEN now() ELSE NULL END,
             error = NULL,
             updated_at = now()
         WHERE user_id = $1`,
        [
          userId,
          state,
          wrap.id,
          snapshot.rows[0].xmin,
          snapshot.rows[0].at,
          mapped,
        ],
      )

      await client.query('COMMIT')
      batches += 1
      copiedThisRun += unmapped.rows.length
      lastState = state

      if (typeof onAfterBatch === 'function') {
        await onAfterBatch({
          remaining,
          copiedThisRun,
          batches,
          state,
          wrapId: wrap.id,
        })
      }
      if (remaining === 0) break
    }

    return reconcileUserLegacyWrap(userId, {
      copiedThisRun,
      batches,
      state: lastState,
      wrapId,
    })
  } catch (error) {
    try {
      await client.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    await markInterrupted(userId, error.message)
    throw error
  } finally {
    client.release()
  }
}

async function reconcileUserLegacyWrap(userId, extras = {}) {
  const result = await db.query(
    `
    WITH src AS (
      SELECT
        m.id,
        m.user_id,
        m.text,
        m.created_at,
        ROW_NUMBER() OVER (ORDER BY m.created_at ASC, m.id ASC) AS rn
      FROM chat_memory m
      WHERE m.user_id = $1
    ),
    dst AS (
      SELECT
        map.chat_memory_id,
        dest.id AS message_id,
        dest.user_id AS dest_user_id,
        dest.text_enc,
        dest.created_at AS dest_created_at,
        dest.seq,
        ROW_NUMBER() OVER (ORDER BY dest.seq ASC) AS rn
      FROM conversation_legacy_map map
      JOIN conversation_messages dest
        ON dest.id = map.conversation_message_id
       AND dest.conversation_id = map.conversation_id
       AND dest.user_id = map.user_id
      WHERE map.user_id = $1
    )
    SELECT
      (SELECT COUNT(*) FROM src) AS source_count,
      (SELECT COUNT(*) FROM dst) AS mapped_count,
      (SELECT COUNT(*) FROM src s WHERE NOT EXISTS (
         SELECT 1 FROM conversation_legacy_map map
         WHERE map.user_id = $1 AND map.chat_memory_id = s.id
       )) AS unmapped_count,
      (SELECT COUNT(*) FROM conversation_messages cm
         JOIN conversations c ON c.id = cm.conversation_id
        WHERE c.user_id = $1 AND c.origin = 'legacy_timeline'
          AND NOT EXISTS (
            SELECT 1 FROM conversation_legacy_map map
            WHERE map.conversation_message_id = cm.id
          )) AS extra_dest_count,
      (SELECT COUNT(*) FROM src s
         JOIN conversation_legacy_map map
           ON map.user_id = s.user_id AND map.chat_memory_id = s.id
         JOIN conversation_messages dest ON dest.id = map.conversation_message_id
        WHERE s.text IS NOT DISTINCT FROM dest.text_enc) AS ciphertext_match_count,
      (SELECT COUNT(*) FROM src s
         JOIN conversation_legacy_map map
           ON map.user_id = s.user_id AND map.chat_memory_id = s.id
         JOIN conversation_messages dest ON dest.id = map.conversation_message_id
        WHERE s.created_at IS NOT DISTINCT FROM dest.created_at) AS timestamp_match_count,
      (SELECT COUNT(*) FROM src s
         JOIN dst d ON d.rn = s.rn
        WHERE s.id IS DISTINCT FROM d.chat_memory_id) AS order_mismatch_count,
      (SELECT COUNT(*) FROM dst d WHERE d.dest_user_id IS DISTINCT FROM $1) AS owner_mismatch_count
    `,
    [userId],
  )
  const migration = await db.query(
    `SELECT state, wrap_conversation_id, mapped_count, snapshot_xmin, error
     FROM user_chat_migration WHERE user_id = $1`,
    [userId],
  )
  const wrap = await db.query(
    `SELECT id, origin, status, legacy_import_key
     FROM conversations
     WHERE user_id = $1 AND origin = 'legacy_timeline'`,
    [userId],
  )
  const identity = await db.query(`
    SELECT current_setting('neon.branch_id', true) AS branch_id,
           current_setting('neon.project_id', true) AS project_id
  `)
  const row = result.rows[0] || {}
  const sourceCount = Number(row.source_count || 0)
  const mapped = Number(row.mapped_count || 0)
  return {
    userId,
    branchId: identity.rows[0]?.branch_id || null,
    projectId: identity.rows[0]?.project_id || null,
    sourceCount,
    mappedCount: mapped,
    unmappedCount: Number(row.unmapped_count || 0),
    extraDestCount: Number(row.extra_dest_count || 0),
    ciphertextMatchCount: Number(row.ciphertext_match_count || 0),
    timestampMatchCount: Number(row.timestamp_match_count || 0),
    orderMismatchCount: Number(row.order_mismatch_count || 0),
    ownerMismatchCount: Number(row.owner_mismatch_count || 0),
    wrapCount: wrap.rows.length,
    wrapId: wrap.rows[0]?.id || extras.wrapId || null,
    wrapOrigin: wrap.rows[0]?.origin || null,
    wrapStatus: wrap.rows[0]?.status || null,
    wrapImportKey: wrap.rows[0]?.legacy_import_key || null,
    state: migration.rows[0]?.state || extras.state || null,
    complete:
      sourceCount === mapped
      && Number(row.unmapped_count || 0) === 0
      && Number(row.extra_dest_count || 0) === 0
      && Number(row.ciphertext_match_count || 0) === sourceCount
      && Number(row.timestamp_match_count || 0) === sourceCount
      && Number(row.order_mismatch_count || 0) === 0
      && Number(row.owner_mismatch_count || 0) === 0
      && wrap.rows.length === 1,
    copiedThisRun: extras.copiedThisRun || 0,
    batches: extras.batches || 0,
  }
}

async function legacyRowFingerprint(userId) {
  const result = await db.query(
    `SELECT COUNT(*)::bigint AS n,
            COALESCE(SUM(id), 0)::bigint AS id_sum,
            COALESCE(SUM(length(text)), 0)::bigint AS text_len,
            COALESCE(SUM(length(COALESCE(training_content, ''))), 0)::bigint AS train_len
     FROM chat_memory
     WHERE user_id = $1`,
    [userId],
  )
  return {
    n: String(result.rows[0].n),
    idSum: String(result.rows[0].id_sum),
    textLen: String(result.rows[0].text_len),
    trainLen: String(result.rows[0].train_len),
  }
}

async function othersFingerprint(excludeUserIds) {
  const result = await db.query(
    `SELECT COUNT(*)::bigint AS n,
            COALESCE(SUM(id), 0)::bigint AS id_sum,
            COALESCE(SUM(length(text)), 0)::bigint AS text_len
     FROM chat_memory
     WHERE NOT (user_id = ANY($1::uuid[]))`,
    [excludeUserIds],
  )
  return {
    n: String(result.rows[0].n),
    idSum: String(result.rows[0].id_sum),
    textLen: String(result.rows[0].text_len),
  }
}

module.exports = {
  WRAP_TITLE,
  WRAP_IMPORT_KEY,
  copyCiphertext,
  wrapUserLegacyTimeline,
  reconcileUserLegacyWrap,
  legacyRowFingerprint,
  othersFingerprint,
}
