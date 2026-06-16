/** @type {import('next').NextConfig} */
// OneDrive on Windows can break the default `.next` folder (readlink EINVAL).
// Keep the alternate distDir for local Windows dev only; Vercel must use `.next`.
const useWindowsCacheDistDir =
  process.platform === 'win32' && !process.env.VERCEL

const nextConfig = {
  reactStrictMode: true,
  ...(useWindowsCacheDistDir ? { distDir: '.cache/next' } : {}),
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/settings',
        destination: '/chat',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
