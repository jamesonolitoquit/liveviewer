import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { FeedbackButton } from '../components/feedback-button'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })

const baseUrl = 'https://jao-liveviewer.vercel.app'

export const metadata: Metadata = {
  title: 'Liveviewer - Accessibility & Design QA',
  description: 'Audit websites for WCAG contrast, typography, and ARIA issues. No API key required.',
  openGraph: {
    title: 'Liveviewer - Accessibility & Design QA',
    description: 'Audit websites for WCAG contrast, typography, and ARIA issues. No API key required.',
    url: baseUrl,
    siteName: 'Liveviewer',
    images: [{ url: `${baseUrl}/og-image.svg`, width: 1200, height: 630 }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liveviewer - Accessibility & Design QA',
    description: 'Audit websites for WCAG contrast, typography, and ARIA issues. No API key required.',
    images: [`${baseUrl}/og-image.svg`],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `
          }}
        />
      </head>
      <body className="min-h-screen" style={{ fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif' }}>
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        {children}
        <FeedbackButton />
      </body>
    </html>
  )
}
