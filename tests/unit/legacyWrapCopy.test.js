const test = require('node:test')
const assert = require('node:assert/strict')
const { PREFIX, encrypt } = require('../../lib/security/encryption')
const { copyCiphertext } = require('../../lib/parle/legacyWrapCopy')

test('copyCiphertext reuses enc:v1 ciphertext and only encrypts plaintext', () => {
  const cipher = `${PREFIX}iv:tag:payload`
  assert.equal(copyCiphertext(cipher), cipher)
  const plain = 'synthetic-wrap-plain'
  const copied = copyCiphertext(plain)
  assert.equal(copied.startsWith(PREFIX), true)
  assert.notEqual(copied, plain)
  const twice = encrypt(plain)
  assert.notEqual(copied, twice)
})
