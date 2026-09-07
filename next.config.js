/** @type {import('next').NextConfig} */
const config = {
  productionBrowserSourceMaps: process.env.NODE_ENV === 'development',
};

export default config;
