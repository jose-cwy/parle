/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Avoid OneDrive readlink EINVAL on Windows (legacy .next folder)
  distDir: '.cache/next',
}

module.exports = nextConfig
