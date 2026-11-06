function isProductionEnv(env = process.env) {
  return String(env.NODE_ENV || '') === 'production'
}

function isV2GenerationDisabled(env = process.env) {
  if (isProductionEnv(env)) return false
  return String(env.PARLE_V2_RECOVERY || '') === '1'
}

function publicGenerationState(env = process.env) {
  const disabled = isV2GenerationDisabled(env)
  return {
    available: !disabled,
    recovery: disabled,
    mode: disabled ? 'generation_disabled' : 'live',
  }
}

function generationUnavailableBody() {
  return {
    error: 'generation_unavailable',
    message: 'Chat replies are temporarily unavailable. You can still read your conversations.',
  }
}

module.exports = {
  isProductionEnv,
  isV2GenerationDisabled,
  publicGenerationState,
  generationUnavailableBody,
}
