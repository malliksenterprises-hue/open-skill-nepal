/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  images: {
    domains: ['localhost', 'open-skill-nepal-669869115660.asia-south1.run.app'],
  },
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'https://open-skill-nepal-669869115660.asia-south1.run.app',
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL || 'https://open-skill-nepal-669869115660.asia-south1.run.app'}/api/:path*`,
      },
    ];
  }
}

module.exports = nextConfig
