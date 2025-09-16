/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next.js 14+: app directory is enabled by default; remove deprecated flag
  env: {
    // Expose API base to the browser; can be overridden at runtime
    NEXT_PUBLIC_STORYCRAFT_API_BASE: process.env.NEXT_PUBLIC_STORYCRAFT_API_BASE || 'http://127.0.0.1:8000',
    // Back-compat for any server-only reads
    STORYCRAFT_API_BASE: process.env.STORYCRAFT_API_BASE || 'http://127.0.0.1:8000',
  },
}

module.exports = nextConfig
