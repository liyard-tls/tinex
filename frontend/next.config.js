/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Don't bundle pdf-parse and its dependencies for server
      config.externals = config.externals || [];
      config.externals.push('pdf-parse', 'canvas');
    }
    return config;
  },
}

module.exports = nextConfig
