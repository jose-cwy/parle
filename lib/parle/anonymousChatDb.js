const {
  logGuestTrainingExchange,
  logGuestTrainingMessage,
} = require('./guestTrainingDb')

async function logAnonymousMessage(sessionToken, role, content, modeId) {
  return logGuestTrainingMessage({
    sessionToken,
    role,
    text: content,
    modeId,
    replyKind: 'normal',
  })
}

async function logAnonymousExchange({ sessionToken, modeId, userText, assistantText, replyKind }) {
  return logGuestTrainingExchange({
    sessionToken,
    modeId,
    userText,
    assistantText,
    replyKind: replyKind || 'normal',
  })
}

module.exports = {
  logAnonymousExchange,
  logAnonymousMessage,
}
