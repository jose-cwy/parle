/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid OneDrive readlink EINVAL on Windows (legacy .next folder)
  distDir: '.cache/next',
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
