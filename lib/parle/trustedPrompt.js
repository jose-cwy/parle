/**
 * Trusted prompt assembly.
 *
 * Client bodies may still send hiddenInjections, contextRecap, or
 * crossSessionSummary. Those fields are untrusted and must never enter
 * system / developer prompt context. Memory, recap, think, quality, and
 * onboarding context are built only from server sources or an allowlisted
 * onboarding enum.
 */

const ONBOARDING_INJECTIONS = {
  heartbreak:
    '[CONTEXT] This user came here because of a heartbreak or breakup. Factor this into your first response — be especially warm and present.',
  friendship_family:
    '[CONTEXT] This user came here because of a friendship or family situation, not a romantic breakup. Adjust your responses accordingly — do not assume romantic context.',
  just_talking:
    '[CONTEXT] This user just needed somewhere to talk. They may not be in acute pain. Be conversational and warm rather than immediately assuming crisis.',
}

function trustedOnboardingReason(value) {
  if (value === 'heartbreak' || value === 'friendship_family' || value === 'just_talking') {
    return value
  }
  return null
}

function trustedOnboardingInjection(reason) {
  const allowed = trustedOnboardingReason(reason)
  return allowed ? ONBOARDING_INJECTIONS[allowed] : null
}

function buildTrustedHiddenInjections({
  onboardingReason,
  qualityBlock,
  thinkBlock,
  clientHiddenInjections,
} = {}) {
  void clientHiddenInjections
  const injections = []
  const onboard = trustedOnboardingInjection(onboardingReason)
  if (onboard) injections.push(onboard)
  if (qualityBlock) injections.push(qualityBlock)
  if (thinkBlock) injections.push(thinkBlock)
  return injections
}

function discardClientPrivilegedPromptFields(body = {}) {
  return {
    hiddenInjections: Array.isArray(body.hiddenInjections) ? body.hiddenInjections : body.hiddenInjections,
    contextRecap: body.contextRecap || null,
    crossSessionSummary: body.crossSessionSummary || null,
  }
}

function assembleUntrustedClientPromptAttempt(body = {}, extras = {}) {
  const discarded = discardClientPrivilegedPromptFields(body)
  return {
    hiddenInjections: buildTrustedHiddenInjections({
      onboardingReason: extras.onboardingReason,
      qualityBlock: extras.qualityBlock,
      thinkBlock: extras.thinkBlock,
      clientHiddenInjections: discarded.hiddenInjections,
    }),
    contextRecap: null,
    crossSessionSummary: extras.storedCrossSessionSummary || null,
  }
}

module.exports = {
  ONBOARDING_INJECTIONS,
  trustedOnboardingReason,
  trustedOnboardingInjection,
  buildTrustedHiddenInjections,
  discardClientPrivilegedPromptFields,
  assembleUntrustedClientPromptAttempt,
}
