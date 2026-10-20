function markDeprecatedRoute(req, res, routeName) {
  const route = String(routeName || 'unknown')
  if (res && typeof res.setHeader === 'function') {
    res.setHeader('Deprecation', 'true')
    res.setHeader('Sunset', 'Wed, 20 Jan 2027 00:00:00 GMT')
  }
  const method = String(req?.method || 'UNKNOWN')
  const hasAuth = Boolean(
    req?.headers?.authorization || req?.headers?.cookie || req?.cookies,
  )
  console.info(
    'deprecated_route',
    JSON.stringify({
      route,
      method,
      hasAuth,
    }),
  )
}

module.exports = {
  markDeprecatedRoute,
}
