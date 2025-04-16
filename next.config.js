/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features
  experimental: {
    appDir: true
  },
  // Configure image optimization
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development'
  },
  // Configure base path and asset prefix for production
  basePath: '',
  assetPrefix: '',
  // Enable source maps in development
  productionBrowserSourceMaps: process.env.NODE_ENV === 'development'
}

module.exports = nextConfig
