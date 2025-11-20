/** @type {import('next').NextConfig} */
const nextConfig = {
  // REMOVE output: 'export' - this is for static sites only
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // Add these for better compatibility
  experimental: {
    appDir: true
  },
  // Enable CORS for your backend
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://open-skill-nepal-669869115660.asia-south1.run.app' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  }
}

module.exports = nextConfig
