/**
 * Fail-closed behaviour when verification schema cannot be read.
 * Schema errors must never mint hs_session, mark a user verified, or grant admin.
 */

function isUndefinedColumnError(error) {
  return error?.code === '42703'
}

function isMissingRelationError(error) {
  return error?.code === '42P01'
}

function isAuthSchemaError(error) {
  return isUndefinedColumnError(error) || isMissingRelationError(error)
}

function loginResponseForSchemaError() {
  return {
    status: 503,
    issueSession: false,
    body: { error: 'Email verification is not ready on this database yet.' },
  }
}

function apiRejectForSchemaError() {
  return {
    status: 503,
    body: { error: 'pending_verification', pending: true },
  }
}

function meResponseForSchemaError() {
  return {
    status: 503,
    body: { error: 'Unable to load session right now.' },
  }
}

function adminDenyForSchemaError() {
  return {
    ok: false,
    status: 503,
    reason: 'schema',
  }
}

function unknownSchemaSessionFlags() {
  return {
    emailVerified: false,
    mustVerify: true,
    legacyUnverified: false,
  }
}

module.exports = {
  isUndefinedColumnError,
  isMissingRelationError,
  isAuthSchemaError,
  loginResponseForSchemaError,
  apiRejectForSchemaError,
  meResponseForSchemaError,
  adminDenyForSchemaError,
  unknownSchemaSessionFlags,
}
