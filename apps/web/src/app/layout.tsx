import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import { FeedbackButton } from '../components/feedback-button'
import { CookieConsent } from '../components/cookie-consent'
import { OnboardingModal } from '../components/onboarding-modal'

const inter = Inter({ subsets: ['latin'], display: 'optional', variable: '--font-inter' })

const baseUrl = 'https://jao-liveviewer.vercel.app'

export const metadata: Metadata = {
  metadataBase: new URL('https://jao-liveviewer.vercel.app'),
  alternates: {
    canonical: '/',
  },
  title: 'Liveviewer – Complete Website Quality Audits',
  description: 'Audit WCAG contrast, design QA, SEO, security headers, legal compliance, and performance. Free, open-source, no tracking.',
  openGraph: {
    title: 'Liveviewer – Complete Website Quality Audits',
    description: 'Audit WCAG contrast, design QA, SEO, security headers, legal compliance, and performance. Free, open-source, no tracking.',
    url: baseUrl,
    siteName: 'Liveviewer',
    images: [{ url: `${baseUrl}/og-image.svg`, width: 1200, height: 630 }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liveviewer – Complete Website Quality Audits',
    description: 'Audit WCAG contrast, design QA, SEO, security headers, legal compliance, and performance. Free, open-source, no tracking.',
    images: [`${baseUrl}/og-image.svg`],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  let initialShow = false
  try {
    const cookieStore = await cookies()
    initialShow = !cookieStore.has('liveviewer_onboarded')
  } catch {}

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "Liveviewer",
              "applicationCategory": "DeveloperApplication",
              "operatingSystem": "Web, CLI",
              "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
              "description": "Free design QA and accessibility tool. Checks WCAG contrast, heading hierarchy, ARIA, and provides fix suggestions.",
              "author": { "@type": "Person", "name": "Jao" }
            })
          }}
        />
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
        <OnboardingModal initialShow={initialShow} />
        <CookieConsent />
        <FeedbackButton />
      </body>
    </html>
  )
}
