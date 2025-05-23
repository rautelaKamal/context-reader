/** @type {import('next').NextConfig} */
const config = {
  // Experimental features
  experimental: {
    // Add any experimental features here if needed
  },
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development'
  },
  // Configure base path and asset prefix for production
  basePath: process.env.NODE_ENV === 'production' ? '' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '' : '',
  // Enable source maps in development
  productionBrowserSourceMaps: process.env.NODE_ENV === 'development',
  // Disable static exports since we're using Render
  output: 'standalone'
}

export default config
