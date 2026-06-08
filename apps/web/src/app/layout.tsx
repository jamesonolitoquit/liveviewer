import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Liveviewer — Design QA Robot',
  description: 'Audit websites for WCAG contrast with AI enrichment. Built by jaostudio.dev.'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('liveviewer_theme');
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  }
                } catch(e) {}
              })();
            `
          }}
        />
      </head>
      <body className="min-h-screen">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  )
}
