/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',  // Enable static exports
  images: {
    unoptimized: true, // Required for static export
  },
  basePath: process.env.NODE_ENV === 'production' ? '/context-reader' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/context-reader/' : '',
}

export default nextConfig
