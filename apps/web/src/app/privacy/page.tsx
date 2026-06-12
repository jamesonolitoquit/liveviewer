import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy - Liveviewer',
  description: 'How Liveviewer handles your data — no tracking, no storage, no surprises.',
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-base text-[var(--jao-text-secondary)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-primary)]"
      >
        &larr; Back to audits
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>

      <section className="mt-8 space-y-6 text-base leading-normal text-[var(--jao-text-secondary)]">
        <p>
          Liveviewer is designed to run in your browser and keep your data on your
          machine. We do not collect, sell, or share any personal information.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">What we store locally</h2>
        <p>All of the following stays in your browser and is never sent to any server:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your theme preference (light or dark mode)</li>
          <li>A list of URLs you have audited recently (up to 20 entries)</li>
          <li>Audit history with scores and failure counts (up to 50 entries, 30-day retention)</li>
          <li>Whether you have dismissed the onboarding screen</li>
          <li>Items you have checked off on the manual WCAG checklist</li>
          <li>Your LLM access key, provider, model, and base URL (cleared when you close the tab)</li>
        </ul>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">What we store on the server</h2>
        <p>
          When you use the Share feature, the audit results are sent to our server and
          stored in memory or Redis with a 7-day expiry. A random 8-character ID is
          generated for the link. No IP address, browser fingerprint, or personal
          identifier is associated with the stored data.
        </p>
        <p>
          If you enable smart enrichment, your LLM access key and failure summaries
          (selectors, colors, ratios) are sent directly from your browser to the LLM
          provider you choose. They never pass through our servers.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">What we do not do</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>No cookies (first-party or third-party)</li>
          <li>No analytics or tracking scripts (no Google Analytics, no Plausible, nothing)</li>
          <li>No advertising or ad tech</li>
          <li>No collection of personal information</li>
          <li>No logging of individual requests</li>
        </ul>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">Your control</h2>
        <p>
          You can clear all stored data at any time through your browser&apos;s Developer
          Tools (Application &rarr; Local Storage &rarr; Clear). No account or login is
          needed to use Liveviewer.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">Changes</h2>
        <p>
          If this policy changes, the update date below will be revised. Continued use
          of Liveviewer after changes means you accept the updated policy.
        </p>

        <p className="pt-4 text-base text-[var(--jao-text-tertiary)]">
          Last updated: June 2026
        </p>
      </section>

      <section className="mt-12 border-t border-[var(--jao-border-subtle)] pt-8 text-center">
        <p className="text-base text-[var(--jao-text-tertiary)]">
          <Link href="/" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Back to Liveviewer
          </Link>
          {' / '}
          <Link href="/privacy" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Privacy Policy
          </Link>
          {' / '}
          <a
            href="https://github.com/jamesonolitoquit/liveviewer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]"
          >
            GitHub
          </a>
          {' / '}
          <Link href="/terms" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Terms of Service
          </Link>
          {' / '}
          <Link href="/imprint" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Imprint
          </Link>
        </p>
      </section>
    </div>
  )
}
