import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service — Liveviewer',
  description: 'Terms of service for Liveviewer website quality audit tool.',
}

export default function TermsPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-base text-[var(--jao-text-secondary)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-primary)]"
      >
        &larr; Back to audits
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>

      <section className="mt-8 space-y-4 text-base leading-normal text-[var(--jao-text-secondary)]">
        <p>
          Liveviewer is a free, open-source tool provided as-is. By using this service, you agree
          to the following terms.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">Use of Service</h2>
        <p>
          You may use Liveviewer to audit any publicly accessible website. You agree not to use the
          service to probe, scan, or disrupt systems without authorization. Automated or excessive
          usage may be rate-limited to ensure fair access for all users.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">Data Handling</h2>
        <p>
          Audit results are processed in real-time and not permanently stored on our servers. Any
          data you choose to save (e.g., shared report links) is retained only as long as necessary
          to provide the service. We do not sell, share, or monetize your data.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">No Warranty</h2>
        <p>
          This tool is provided without warranty of any kind. Audit results are for informational
          purposes and do not constitute a formal accessibility or compliance assessment. Always
          verify findings with a qualified professional.
        </p>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--jao-text)]">Changes</h2>
        <p>
          We reserve the right to update these terms at any time. Continued use of Liveviewer
          after changes means you accept the updated terms.
        </p>
      </section>

      <p className="pt-4 text-base text-[var(--jao-text-tertiary)]">
        Last updated: June 2026
      </p>

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
