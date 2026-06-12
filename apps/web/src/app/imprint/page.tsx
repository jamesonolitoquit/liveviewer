import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Imprint — Liveviewer',
  description: 'Legal notice and imprint for Liveviewer website quality audit tool.',
}

export default function ImprintPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-base text-[var(--jao-text-secondary)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-primary)]"
      >
        &larr; Back to audits
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Imprint</h1>

      <section className="mt-8 space-y-4 text-base leading-normal text-[var(--jao-text-secondary)]">
        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">Contact</h2>
        <p>
          Jao Studio
          <br />
          Email: <a href="mailto:hello@jaostudio.dev" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">hello@jaostudio.dev</a>
          <br />
          Web: <a href="https://jaostudio.dev" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">jaostudio.dev</a>
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">Disclaimer</h2>
        <p>
          The content on this website is provided for general informational purposes. While we
          strive to keep the tool functional and accurate, no guarantees are made regarding the
          completeness or reliability of the audit results.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">External Links</h2>
        <p>
          This website may contain links to external third-party websites. We have no control over
          the content or practices of those sites and assume no responsibility for them.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">Copyright</h2>
        <p>
          Liveviewer is open-source software. See the{' '}
          <a
            href="https://github.com/jamesonolitoquit/liveviewer"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]"
          >
            GitHub repository
          </a>{' '}
          for license information.
        </p>
      </section>

      <section className="mt-12 border-t border-[var(--jao-border-subtle)] pt-8 text-center">
        <p className="text-base text-[var(--jao-text-tertiary)]">
          <Link href="/" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Back to Liveviewer
          </Link>
          {' / '}
          <Link href="/privacy" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Privacy
          </Link>
          {' / '}
          <Link href="/terms" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Terms of Service
          </Link>
          {' / '}
          <Link href="/imprint" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Imprint
          </Link>
        </p>
        <p className="mt-4 text-base text-[var(--jao-text-tertiary)]">
          We do not collect or share your data. See our <Link href="/privacy" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">privacy policy</Link>.
        </p>
      </section>
    </div>
  )
}
