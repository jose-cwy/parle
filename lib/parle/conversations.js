const crypto = require('crypto')
const db = require('../db')
const { encrypt, decrypt } = require('../security/encryption')
const { scrubPII } = require('./scrubPII')
const { sanitizeChatMessage } = require('../security/sanitize')
const {
  streamChatReply,
  shouldPersistStreamedReply,
  attachClientAbort,
} = require('./chatStreamResponse')
const {
  encodeLegacyCursor,
  decodeLegacyCursor,
  parseLegacyLimit,
  parseTimelineVersion,
} = require('./legacyCursor')
const { generationUnavailableBody } = require('./v2Recovery')
const {
  isV2GenerationBlocked,
  publicGenerationSnapshot,
} = require('./v2GenerationControl')

const LEASE_MS = 90_000
const PRIVILEGED_ROLES = new Set(['system', 'developer'])

function leaseOwner() {
  return `${process.env.VERCEL_REGION || 'local'}:${process.pid}`
}

function leaseExpiry() {
  return new Date(Date.now() + LEASE_MS)
}

function assertUuid(id) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(id || ''),
    )
  ) {
    throw notFound()
  }
}

function notFound() {
  const error = new Error('not_found')
  error.statusCode = 404
  error.body = { error: 'Not found' }
  return error
}

function busy() {
  const error = new Error('processing')
  error.statusCode = 429
  error.body = { error: 'processing' }
  return error
}

function decryptMessage(row) {
  if (!row) return row
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    role: row.role,
    text: decrypt(row.text_enc),
    seq: Number(row.seq),
    created_at: row.created_at,
  }
}

function publicConversation(row) {
  if (!row) return row
  return {
    id: row.id,
    status: row.status,
    origin: row.origin,
    mode_id: row.mode_id,
    title: row.title_enc ? decrypt(row.title_enc) : '',
    last_message_at: row.last_message_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    readOnly: row.origin === 'legacy_timeline',
    timelineVersion: wrapTimelineVersion(row),
  }
}

function wrapTimelineVersion(row) {
  if (!row) return null
  if (row.origin === 'legacy_timeline' && row.timeline_revision != null) {
    return String(row.timeline_revision)
  }
  return row.updated_at ? String(new Date(row.updated_at).getTime()) : null
}

async function withGeneration(payload) {
  return {
    ...payload,
    generation: await publicGenerationSnapshot(),
  }
}

async function latestIncompleteStream(userId, conversationId) {
  const result = await db.query(
    `SELECT status, error_code, lease_expires_at, user_message_id, assistant_message_id
     FROM conversation_requests
     WHERE user_id = $1 AND conversation_id = $2
       AND status IN ('failed', 'cancelled', 'streaming', 'accepted')
     ORDER BY updated_at DESC
     LIMIT 1`,
    [userId, conversationId],
  )
  const row = result.rows[0]
  if (!row) return null
  if (row.status === 'streaming' && isLiveLease(row)) {
    return { state: 'processing', retryable: false, errorCode: row.error_code || null }
  }
  const blocked = await isV2GenerationBlocked()
  if (row.status === 'streaming' || row.status === 'accepted') {
    return { state: 'interrupted', retryable: !blocked, errorCode: row.error_code || null }
  }
  return {
    state: row.status,
    retryable: !blocked && row.status === 'failed',
    errorCode: row.error_code || null,
  }
}

function filterClientHistory(messages) {
  if (!Array.isArray(messages)) return []
  return messages
    .filter((item) => item && !PRIVILEGED_ROLES.has(String(item.role || '').toLowerCase()))
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({
      role: item.role,
      text: sanitizeChatMessage(item.text || item.content || ''),
    }))
    .filter((item) => item.text)
}

async function createConversation(userId, { modeId = 'cross', origin = 'live' } = {}) {
  const result = await db.query(
    `INSERT INTO conversations (user_id, mode_id, origin, status)
     VALUES ($1, $2, $3, 'active')
     RETURNING *`,
    [userId, modeId || 'cross', origin || 'live'],
  )
  return publicConversation(result.rows[0])
}

async function listConversations(userId, { status = 'active' } = {}) {
  const wanted = status === 'archived' ? 'archived' : 'active'
  const result = await db.query(
    `SELECT * FROM conversations
     WHERE user_id = $1 AND status = $2
       AND origin <> 'legacy_timeline'
     ORDER BY COALESCE(last_message_at, created_at) DESC, created_at DESC
     LIMIT 80`,
    [userId, wanted],
  )
  return (result.rows || []).map(publicConversation)
}

async function getOwnedConversation(userId, conversationId, { statuses = ['active'] } = {}) {
  assertUuid(conversationId)
  const allowed = Array.isArray(statuses) && statuses.length ? statuses : ['active']
  const result = await db.query(
    `SELECT * FROM conversations
     WHERE id = $1 AND user_id = $2 AND status = ANY($3::text[])`,
    [conversationId, userId, allowed],
  )
  if (!result.rows[0]) throw notFound()
  return result.rows[0]
}

async function archiveConversation(userId, conversationId) {
  assertUuid(conversationId)
  const current = await db.query(
    `SELECT origin FROM conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  if (!current.rows[0]) throw notFound()
  if (current.rows[0].origin === 'legacy_timeline') {
    const error = new Error('read_only_history')
    error.statusCode = 403
    error.body = { error: 'read_only_history' }
    throw error
  }
  const result = await db.query(
    `UPDATE conversations
     SET status = 'archived', updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'active'
     RETURNING *`,
    [conversationId, userId],
  )
  if (!result.rows[0]) throw notFound()
  return publicConversation(result.rows[0])
}

async function restoreConversation(userId, conversationId) {
  assertUuid(conversationId)
  const current = await db.query(
    `SELECT origin FROM conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  if (!current.rows[0]) throw notFound()
  if (current.rows[0].origin === 'legacy_timeline') {
    const error = new Error('read_only_history')
    error.statusCode = 403
    error.body = { error: 'read_only_history' }
    throw error
  }
  const result = await db.query(
    `UPDATE conversations
     SET status = 'active', updated_at = now()
     WHERE id = $1 AND user_id = $2 AND status = 'archived'
     RETURNING *`,
    [conversationId, userId],
  )
  if (!result.rows[0]) throw notFound()
  return publicConversation(result.rows[0])
}

function publicMigration(row) {
  const state = row?.state || 'absent'
  return {
    state,
    mappedCount: Number(row?.mapped_count || 0),
    complete: state === 'migrated',
    incomplete: state === 'migrating' || state === 'interrupted',
    pendingQuiesce: state === 'pending_quiesce',
  }
}

async function listLegacyWrap(userId) {
  const wrap = await db.query(
    `SELECT * FROM conversations
     WHERE user_id = $1 AND origin = 'legacy_timeline'
     LIMIT 1`,
    [userId],
  )
  const migration = await db.query(
    `SELECT state, mapped_count FROM user_chat_migration WHERE user_id = $1`,
    [userId],
  )
  if (!wrap.rows[0]) {
    return await withGeneration({ conversation: null, migration: publicMigration({ state: 'absent' }) })
  }
  return await withGeneration({
    conversation: publicConversation(wrap.rows[0]),
    migration: publicMigration(migration.rows[0] || { state: 'pending_quiesce' }),
  })
}

async function getLegacyWrapTranscript(userId, conversation, {
  cursor = null,
  limit = 50,
  version = null,
} = {}) {
  const decoded = decodeLegacyCursor(cursor)
  const pageSize = parseLegacyLimit(limit)
  const clientVersion = parseTimelineVersion(version)
  const published = publicConversation(conversation)
  const timelineVersion = published.timelineVersion
  const stale = Boolean(decoded && clientVersion && timelineVersion && clientVersion !== timelineVersion)
  const afterSeq = decoded && Number.isFinite(Number(decoded.position)) ? Number(decoded.position) : null
  const useCursor = Boolean(decoded && !stale && afterSeq != null)

  const result = useCursor
    ? await db.query(
        `SELECT id AS message_id, conversation_id, role, text_enc, seq, created_at
         FROM conversation_messages
         WHERE conversation_id = $1 AND user_id = $2 AND seq > $3::bigint
         ORDER BY seq ASC, id ASC
         LIMIT $4::bigint`,
        [conversation.id, userId, afterSeq, pageSize + 1],
      )
    : await db.query(
        `SELECT id AS message_id, conversation_id, role, text_enc, seq, created_at
         FROM conversation_messages
         WHERE conversation_id = $1 AND user_id = $2
         ORDER BY seq ASC, id ASC
         LIMIT $3::bigint`,
        [conversation.id, userId, pageSize + 1],
      )
  const rows = (result.rows || []).map((row) => ({
    ...row,
    id: row.message_id,
  }))
  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page[page.length - 1]
  const migration = await db.query(
    `SELECT state, mapped_count FROM user_chat_migration WHERE user_id = $1`,
    [userId],
  )
  return await withGeneration({
    conversation: published,
    messages: page.map(decryptMessage),
    nextCursor: hasMore && last ? encodeLegacyCursor(last.created_at, last.id, last.seq) : null,
    hasMore,
    stale,
    timelineVersion,
    migration: publicMigration(migration.rows[0] || { state: 'pending_quiesce' }),
  })
}

async function getConversation(userId, conversationId, options = {}) {
  const conversation = await getOwnedConversation(userId, conversationId, {
    statuses: ['active', 'archived'],
  })
  if (conversation.origin === 'legacy_timeline') {
    return getLegacyWrapTranscript(userId, conversation, options)
  }
  const limit = Math.min(200, Math.max(1, Number(options.limit) || 80))
  const messages = await db.query(
    `SELECT id, conversation_id, role, text_enc, seq, created_at
     FROM conversation_messages
     WHERE conversation_id = $1 AND user_id = $2
     ORDER BY seq DESC
     LIMIT $3`,
    [conversationId, userId, limit],
  )
  return await withGeneration({
    conversation: publicConversation(conversation),
    messages: (messages.rows || []).map(decryptMessage).reverse(),
    incompleteStream: await latestIncompleteStream(userId, conversationId),
  })
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

async function insertOwnedMessage(client, { userId, conversationId, role, text, clientMessageId }) {
  const seq = await nextSeq(client, conversationId)
  const stored = encrypt(text)
  const training = encrypt(scrubPII(text))
  const inserted = await client.query(
    `INSERT INTO conversation_messages
      (conversation_id, user_id, role, seq, text_enc, training_content_enc, client_message_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, seq, created_at`,
    [conversationId, userId, role, seq, stored, training, clientMessageId || null],
  )
  await client.query(
    `UPDATE conversations
     SET last_message_at = now(), updated_at = now()
     WHERE id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  return inserted.rows[0]
}

async function loadThread(userId, conversationId) {
  const origin = await db.query(
    `SELECT origin FROM conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId],
  )
  if (origin.rows[0]?.origin === 'legacy_timeline') return []
  const result = await db.query(
    `SELECT role, text_enc
     FROM conversation_messages
     WHERE conversation_id = $1 AND user_id = $2
     ORDER BY seq ASC
     LIMIT 40`,
    [conversationId, userId],
  )
  return (result.rows || []).map((row) => ({
    role: row.role,
    text: decrypt(row.text_enc),
  }))
}

function isLiveLease(request) {
  if (!request || request.status !== 'streaming') return false
  if (!request.lease_expires_at) return false
  return new Date(request.lease_expires_at).getTime() > Date.now()
}

async function peekRequest(userId, conversationId, idempotencyKey) {
  const result = await db.query(
    `SELECT * FROM conversation_requests
     WHERE user_id = $1 AND conversation_id = $2 AND idempotency_key = $3`,
    [userId, conversationId, idempotencyKey],
  )
  return result.rows[0] || null
}

async function loadAssistantReply(userId, assistantMessageId) {
  if (!assistantMessageId) return ''
  const result = await db.query(
    `SELECT text_enc FROM conversation_messages WHERE id = $1 AND user_id = $2`,
    [assistantMessageId, userId],
  )
  if (!result.rows[0]) return ''
  return decrypt(result.rows[0].text_enc)
}

async function replayPayload(request, conversationId, userId) {
  const reply = await loadAssistantReply(userId, request.assistant_message_id)
  return {
    replay: true,
    requestId: request.id,
    conversationId,
    reply,
  }
}

async function upsertRequest(userId, conversationId, idempotencyKey) {
  const inserted = await db.query(
    `INSERT INTO conversation_requests
      (user_id, conversation_id, idempotency_key, status)
     VALUES ($1, $2, $3, 'accepted')
     ON CONFLICT (user_id, conversation_id, idempotency_key)
     DO NOTHING
     RETURNING *`,
    [userId, conversationId, idempotencyKey],
  )
  if (inserted.rows[0]) return { request: inserted.rows[0], created: true }

  const existing = await peekRequest(userId, conversationId, idempotencyKey)
  return { request: existing, created: false }
}

async function acquireLease(request) {
  if (request.status === 'completed') return { request, acquired: false, replay: true }
  const token = crypto.randomUUID()
  const taken = await db.query(
    `UPDATE conversation_requests
     SET status = 'streaming',
         lease_owner = $2,
         lease_token = $3,
         lease_expires_at = $4,
         updated_at = now(),
         error_code = NULL
     WHERE id = $1
       AND user_id = $5
       AND status <> 'completed'
       AND (
         status IN ('accepted', 'failed', 'cancelled')
         OR (status = 'streaming' AND (lease_expires_at IS NULL OR lease_expires_at < now()))
       )
     RETURNING *`,
    [request.id, leaseOwner(), token, leaseExpiry(), request.user_id],
  )
  if (taken.rows[0]) return { request: taken.rows[0], acquired: true, replay: false }
  throw busy()
}

async function touchLease(requestId, userId, leaseToken) {
  const result = await db.query(
    `UPDATE conversation_requests
     SET lease_expires_at = $4, updated_at = now()
     WHERE id = $1
       AND user_id = $2
       AND lease_token = $3
       AND status = 'streaming'
     RETURNING id`,
    [requestId, userId, leaseToken, leaseExpiry()],
  )
  return Boolean(result.rows[0])
}

async function finishOwnedRequest(requestId, userId, leaseToken, patch) {
  const result = await db.query(
    `UPDATE conversation_requests
     SET status = $4,
         assistant_message_id = COALESCE($5, assistant_message_id),
         user_message_id = COALESCE($6, user_message_id),
         error_code = $7,
         lease_expires_at = now(),
         updated_at = now()
     WHERE id = $1
       AND user_id = $2
       AND lease_token = $3
       AND status = 'streaming'
     RETURNING id`,
    [
      requestId,
      userId,
      leaseToken,
      patch.status,
      patch.assistantMessageId || null,
      patch.userMessageId || null,
      patch.errorCode || null,
    ],
  )
  return Boolean(result.rows[0])
}

async function persistAssistantIfOwner({
  userId,
  conversationId,
  requestId,
  leaseToken,
  text,
  userMessageId,
}) {
  const write = await db.pool.connect()
  try {
    await write.query('BEGIN')
    const owned = await write.query(
      `SELECT id FROM conversation_requests
       WHERE id = $1
         AND user_id = $2
         AND lease_token = $3
         AND status = 'streaming'
       FOR UPDATE`,
      [requestId, userId, leaseToken],
    )
    if (!owned.rows[0]) {
      await write.query('ROLLBACK')
      return null
    }
    await write.query(
      `SELECT id FROM conversations WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [conversationId, userId],
    )
    const assistant = await insertOwnedMessage(write, {
      userId,
      conversationId,
      role: 'assistant',
      text,
    })
    const finished = await write.query(
      `UPDATE conversation_requests
       SET status = 'completed',
           assistant_message_id = $4,
           user_message_id = COALESCE($5, user_message_id),
           error_code = NULL,
           lease_expires_at = now(),
           updated_at = now()
       WHERE id = $1
         AND user_id = $2
         AND lease_token = $3
         AND status = 'streaming'
       RETURNING id`,
      [requestId, userId, leaseToken, assistant.id, userMessageId || null],
    )
    if (!finished.rows[0]) {
      await write.query('ROLLBACK')
      return null
    }
    await write.query('COMMIT')
    return assistant
  } catch (error) {
    try {
      await write.query('ROLLBACK')
    } catch {
      /* ignore */
    }
    throw error
  } finally {
    write.release()
  }
}

async function sendConversationMessage(req, res, {
  userId,
  conversationId,
  text,
  idempotencyKey,
  clientMessageId,
  clientMessages,
  streamFn,
  completionMessages: providedCompletion,
  safetyReply,
  safetyKind,
} = {}) {
  const owned = await getOwnedConversation(userId, conversationId)
  if (owned.origin === 'legacy_timeline') {
    const error = new Error('read_only_history')
    error.statusCode = 403
    error.body = { error: 'read_only_history' }
    throw error
  }
  const safeText = sanitizeChatMessage(text)
  if (!safeText) {
    const error = new Error('empty_message')
    error.statusCode = 400
    error.body = { error: 'empty_message' }
    throw error
  }

  const key = String(idempotencyKey || crypto.randomUUID())
  const existing = await peekRequest(userId, conversationId, key)
  if (existing?.status === 'completed') {
    return replayPayload(existing, conversationId, userId)
  }
  if (await isV2GenerationBlocked()) {
    const error = new Error('generation_unavailable')
    error.statusCode = 503
    error.body = generationUnavailableBody()
    throw error
  }
  const { request: stored } = await upsertRequest(userId, conversationId, key)
  if (stored.status === 'completed') {
    return replayPayload(stored, conversationId, userId)
  }

  const acquired = await acquireLease(stored)
  if (acquired.replay) {
    return replayPayload(stored, conversationId, userId)
  }
  const request = acquired.request
  const leaseToken = request.lease_token

  const client = await db.pool.connect()
  let userMessage
  try {
    await client.query('BEGIN')
    await client.query(
      `SELECT id FROM conversations WHERE id = $1 AND user_id = $2 AND status = 'active' FOR UPDATE`,
      [conversationId, userId],
    )
    if (request.user_message_id) {
      const existing = await client.query(
        `SELECT id, seq, created_at FROM conversation_messages WHERE id = $1 AND user_id = $2`,
        [request.user_message_id, userId],
      )
      userMessage = existing.rows[0]
      if (!userMessage) {
        userMessage = await insertOwnedMessage(client, {
          userId,
          conversationId,
          role: 'user',
          text: safeText,
          clientMessageId,
        })
        await client.query(
          `UPDATE conversation_requests SET user_message_id = $3, updated_at = now()
           WHERE id = $1 AND user_id = $2`,
          [request.id, userId, userMessage.id],
        )
      }
    } else {
      userMessage = await insertOwnedMessage(client, {
        userId,
        conversationId,
        role: 'user',
        text: safeText,
        clientMessageId,
      })
      await client.query(
        `UPDATE conversation_requests SET user_message_id = $3, updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [request.id, userId, userMessage.id],
      )
    }
    await client.query('COMMIT')
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      if (error && error.code === '23505') {
        const conflict = new Error('duplicate_message')
        conflict.statusCode = 409
        conflict.body = { error: 'duplicate_message' }
        throw conflict
      }
      throw error
    } finally {
      client.release()
    }

  if (safetyReply) {
    const saved = await persistAssistantIfOwner({
      userId,
      conversationId,
      requestId: request.id,
      leaseToken,
      text: safetyReply,
      userMessageId: userMessage.id,
    })
    if (!saved) {
      return { ok: false, lostLease: true, requestId: request.id, conversationId }
    }
    return {
      ok: true,
      safety: safetyKind === 'safety',
      guardrail: safetyKind === 'guardrail',
      reply: safetyReply,
      requestId: request.id,
      conversationId,
    }
  }

  const abort = attachClientAbort(req, res)
  const history = await loadThread(userId, conversationId)
  const filtered = filterClientHistory(clientMessages)
  let completionMessages = providedCompletion
  if (!Array.isArray(completionMessages) || !completionMessages.length) {
    completionMessages = (filtered.length ? filtered : history).map((item) => ({
      role: item.role,
      content: item.text,
    }))
    if (!completionMessages.length || completionMessages[completionMessages.length - 1].role !== 'user') {
      completionMessages.push({ role: 'user', content: safeText })
    }
  }

  try {
    const heartbeat = async () => {
      const stillOwned = await touchLease(request.id, userId, leaseToken)
      if (!stillOwned) abort.abort()
      return stillOwned
    }
    const innerStream = streamFn || require('../openai').openaiChatStream
    const wrappedStream = async function* wrapped(opts) {
      for await (const delta of innerStream(opts)) {
        const owned = await heartbeat()
        if (!owned) return
        yield delta
      }
    }

    const streamed = await streamChatReply(res, {
      messages: completionMessages,
      extraHeaders: {
        'X-Parle-Request-Id': request.id,
        'X-Parle-Conversation-Id': conversationId,
      },
      signal: abort.signal,
      streamFn: wrappedStream,
      deferComplete: true,
    })
    const stillOwned = await touchLease(request.id, userId, leaseToken)
    if (!stillOwned) {
      if (typeof streamed.complete === 'function') streamed.complete({ error: 'lost_lease' })
      return { ok: false, lostLease: true, requestId: request.id, conversationId }
    }
    if (shouldPersistStreamedReply(streamed)) {
      const assistant = await persistAssistantIfOwner({
        userId,
        conversationId,
        requestId: request.id,
        leaseToken,
        text: streamed.reply,
        userMessageId: userMessage.id,
      })
      if (!assistant) {
        if (typeof streamed.complete === 'function') streamed.complete({ error: 'lost_lease' })
        return { ok: false, lostLease: true, requestId: request.id, conversationId }
      }
      if (typeof streamed.complete === 'function') streamed.complete()
      return { ok: true, requestId: request.id, conversationId }
    }

    await finishOwnedRequest(request.id, userId, leaseToken, {
      status: streamed?.aborted ? 'cancelled' : 'failed',
      userMessageId: userMessage.id,
      errorCode: streamed?.aborted
        ? 'aborted'
        : streamed?.providerError
          ? 'provider_error'
          : 'empty_reply',
    })
    if (typeof streamed.complete === 'function' && !streamed.providerError && !streamed.aborted) {
      streamed.complete({ error: streamed?.providerError ? 'provider_error' : 'empty_reply' })
    } else if (typeof streamed.complete === 'function' && streamed.aborted) {
      try {
        if (typeof res.end === 'function' && !res.writableEnded) res.end()
      } catch {
        /* ignore */
      }
    }
    return { ok: false, requestId: request.id, conversationId, providerError: Boolean(streamed?.providerError) }
  } catch (error) {
    await finishOwnedRequest(request.id, userId, leaseToken, {
      status: 'failed',
      userMessageId: userMessage.id,
      errorCode: 'provider_error',
    }).catch(() => {})
    throw error
  } finally {
    abort.dispose()
  }
}

module.exports = {
  LEASE_MS,
  filterClientHistory,
  createConversation,
  listConversations,
  archiveConversation,
  restoreConversation,
  getConversation,
  listLegacyWrap,
  getOwnedConversation,
  sendConversationMessage,
  upsertRequest,
  acquireLease,
  peekRequest,
  isLiveLease,
  touchLease,
  persistAssistantIfOwner,
  replayPayload,
  publicConversation,
  withGeneration,
  wrapTimelineVersion,
}
