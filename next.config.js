/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  basePath: process.env.NODE_ENV === 'production' ? '/context-reader' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/context-reader/' : '',
  // Disable server-side features for static export
  experimental: {
    appDir: true
  }
}

module.exports = nextConfig
