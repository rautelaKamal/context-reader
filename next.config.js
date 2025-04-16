/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true
  },
  // Enable image optimization
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig
