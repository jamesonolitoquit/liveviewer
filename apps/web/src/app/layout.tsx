import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Liveviewer — Design QA Robot',
  description: 'Audit websites for WCAG contrast, design tokens, and performance. Run audits directly in your browser with optional AI enrichment.'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
