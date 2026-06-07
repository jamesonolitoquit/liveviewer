import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  transpilePackages: ['@liveviewer/core', '@liveviewer/llm'],
  outputFileTracingRoot: path.join(import.meta.dirname, '..', '..'),
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  }
}

export default nextConfig
