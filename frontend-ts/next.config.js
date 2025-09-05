/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    STORYCRAFT_API_BASE: process.env.STORYCRAFT_API_BASE || 'http://localhost:8001',
  },
}

module.exports = nextConfig