import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  serverExternalPackages: ['lighthouse', 'chrome-launcher'],
  outputFileTracingRoot: path.join(__dirname, '../../'),
  outputFileTracingIncludes: {
    '/api/*': [
      './node_modules/lighthouse/report/assets/standalone-template.html',
      './node_modules/lighthouse/report/assets/styles.css',
      './node_modules/lighthouse/dist/report/standalone.js',
      './node_modules/lighthouse/flow-report/assets/standalone-flow-template.html',
      './node_modules/lighthouse/flow-report/assets/styles.css',
      './node_modules/lighthouse/dist/report/flow.js',
      './node_modules/lighthouse/**',
      './node_modules/chrome-launcher/**',
      './node_modules/@sparticuz/chromium-min/**'
    ]
  },
  transpilePackages: ['@liveviewer/core'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@headlessui/react'],
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://api.deepseek.com https://api.groq.com; frame-src 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ]
  },
}

export default nextConfig
