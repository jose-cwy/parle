const test = require('node:test')
const assert = require('node:assert/strict')
const { setChatLocalUserId } = require('../../lib/parle/chatPreferences')
const {
  saveChatArchive,
  getChatArchives,
  removeChatArchive,
  isArchiveDeleted,
  pruneArchivesMatchingMessages,
} = require('../../lib/parle/chatArchives')

function installLocalStorage() {
  const store = new Map()
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  }
  global.window = { localStorage }
  global.localStorage = localStorage
}

test('save after remove does not resurrect a tombstoned archive', () => {
  installLocalStorage()
  setChatLocalUserId('user-archive-test')

  const messages = [
    { role: 'user', text: 'hello' },
    { role: 'assistant', text: 'hey' },
  ]
  assert.equal(
    saveChatArchive({ id: 'chat-1', title: 'Hello', messages }),
    true,
  )
  assert.equal(getChatArchives().length, 1)

  removeChatArchive('chat-1')
  assert.equal(getChatArchives().length, 0)
  assert.equal(isArchiveDeleted('chat-1'), true)
  assert.equal(
    saveChatArchive({ id: 'chat-1', title: 'Hello', messages }),
    false,
  )
  assert.equal(getChatArchives().length, 0)
})

test('prune by fingerprint tombstones matching archives', () => {
  installLocalStorage()
  setChatLocalUserId('user-prune-test')

  const messages = [
    { role: 'user', text: 'same story' },
    { role: 'assistant', text: 'got it' },
  ]
  saveChatArchive({ id: 'dup-1', title: 'A', messages })
  pruneArchivesMatchingMessages(messages)
  assert.equal(getChatArchives().length, 0)
  assert.equal(isArchiveDeleted('dup-1'), true)
})
