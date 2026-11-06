const test = require('node:test')
const assert = require('node:assert/strict')
const {
  readConversationIdFromUrl,
  resolveConversationSelection,
  shouldApplyBootstrappedConversation,
  resolveActiveConversationRef,
  mergeLegacyPages,
} = require('../../lib/parle/conversationClient')

const chatC = { id: 'chat-c', status: 'active' }
const chatD = { id: 'chat-d', status: 'active' }
const archivedC = { id: 'chat-c', status: 'archived' }

test('URL ?c= wins over stored and list order', () => {
  const resolved = resolveConversationSelection({
    urlId: 'chat-d',
    storedId: 'chat-c',
    conversations: [chatC, chatD],
  })
  assert.equal(resolved.source, 'url')
  assert.equal(resolved.fetchId, 'chat-d')
  assert.equal(resolved.allowListFallback, false)
  assert.equal(resolved.listed, true)
})

test('valid URL id is fetched even when missing from the first list page', () => {
  const resolved = resolveConversationSelection({
    urlId: 'chat-d',
    storedId: 'chat-c',
    conversations: [chatC],
  })
  assert.equal(resolved.fetchId, 'chat-d')
  assert.equal(resolved.listed, false)
  assert.equal(resolved.allowListFallback, false)
})

test('invalid URL id does not fall back to another conversation', () => {
  const resolved = resolveConversationSelection({
    urlId: 'missing-or-foreign',
    storedId: 'chat-c',
    conversations: [chatC, chatD],
  })
  assert.equal(resolved.fetchId, 'missing-or-foreign')
  assert.equal(resolved.allowListFallback, false)
})

test('missing URL may use stored selection', () => {
  const resolved = resolveConversationSelection({
    urlId: null,
    storedId: 'chat-d',
    conversations: [chatC, chatD],
  })
  assert.equal(resolved.source, 'stored')
  assert.equal(resolved.fetchId, 'chat-d')
  assert.equal(resolved.allowListFallback, false)
})

test('stored selection does not silently open a different chat', () => {
  const resolved = resolveConversationSelection({
    urlId: null,
    storedId: 'deleted-chat',
    conversations: [chatC],
  })
  assert.equal(resolved.fetchId, 'deleted-chat')
  assert.equal(resolved.allowListFallback, false)
})

test('no URL or stored id may use the first authorized active conversation', () => {
  const resolved = resolveConversationSelection({
    urlId: null,
    storedId: null,
    conversations: [chatC, chatD],
  })
  assert.equal(resolved.source, 'list')
  assert.equal(resolved.fetchId, 'chat-c')
  assert.equal(resolved.allowListFallback, true)
})

test('archived URL conversation is treated as requested, not replaced', () => {
  const resolved = resolveConversationSelection({
    urlId: 'chat-c',
    storedId: 'chat-d',
    conversations: [chatD],
    archivedConversations: [archivedC],
  })
  assert.equal(resolved.source, 'url')
  assert.equal(resolved.fetchId, 'chat-c')
  assert.equal(resolved.listed, true)
  assert.equal(resolved.allowListFallback, false)
})

test('readConversationIdFromUrl reads c and ignores other params', () => {
  assert.equal(readConversationIdFromUrl('?foo=1&c=chat-d'), 'chat-d')
  assert.equal(readConversationIdFromUrl('http://127.0.0.1:3075/chat?c=chat-d'), 'chat-d')
  assert.equal(readConversationIdFromUrl('/chat'), null)
})

test('stale bootstrap cannot apply Chat C after New Chat selected Chat D', () => {
  assert.equal(
    shouldApplyBootstrappedConversation({
      bootGen: 1,
      currentGen: 2,
      fetchId: 'chat-c',
      urlId: 'chat-d',
      activeId: 'chat-d',
    }),
    false,
  )
  assert.equal(
    shouldApplyBootstrappedConversation({
      bootGen: 2,
      currentGen: 2,
      fetchId: 'chat-c',
      urlId: 'chat-d',
      activeId: 'chat-d',
    }),
    false,
  )
})

test('New Chat in flight keeps the created UUID when React state is still Chat 1', () => {
  assert.equal(
    resolveActiveConversationRef({
      creating: true,
      createPending: true,
      renderedId: 'chat-1',
      rememberedId: 'chat-2',
    }),
    'chat-2',
  )
})

test('after New Chat settles, React state is the source of truth', () => {
  assert.equal(
    resolveActiveConversationRef({
      creating: false,
      createPending: false,
      renderedId: 'chat-2',
      rememberedId: 'chat-2',
    }),
    'chat-2',
  )
})

test('bootstrap applies only the requested conversation', () => {
  assert.equal(
    shouldApplyBootstrappedConversation({
      bootGen: 3,
      currentGen: 3,
      fetchId: 'chat-d',
      urlId: 'chat-d',
      activeId: 'chat-d',
    }),
    true,
  )
})

test('legacy page merge keeps original order and drops duplicate ids', () => {
  const merged = mergeLegacyPages(
    [{ id: 'a', text: 'one' }, { id: 'b', text: 'two' }],
    [{ id: 'b', text: 'dup' }, { id: 'c', text: 'three' }],
  )
  assert.deepEqual(merged.map((row) => row.id), ['a', 'b', 'c'])
  assert.equal(merged[1].text, 'two')
})
