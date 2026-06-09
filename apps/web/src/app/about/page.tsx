import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About — Liveviewer',
  description: 'Free, open-source tool for WCAG contrast audits, design QA checks, and ARIA validation. No API key needed, no tracking.',
}

export default function AboutPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-6 py-16">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1 text-sm text-[var(--jao-text-secondary)] underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-primary)]"
      >
        &larr; Back to audits
      </Link>

      <h1 className="text-3xl font-bold tracking-tight">About Liveviewer</h1>

      <section className="mt-8 space-y-4 text-base leading-relaxed text-[var(--jao-text-secondary)]">
        <p>
          I kept finding low-contrast text on my own projects. Text that looked fine to me but failed
          WCAG standards. Tools existed, but they were either too heavy (full Lighthouse audits), too
          expensive, or locked behind API keys.
        </p>

        <p>
          So I built Liveviewer. A tool that checks your site for common contrast issues, design
          problems, and ARIA violations. No signup required. No API key needed for the basic checks.
          It is fully open source — you can inspect the code, run it yourself, and trust what it does.
        </p>

        <p>
          It runs right in your browser or as a CLI command in your CI pipeline. You get a list of
          things to fix, with deterministic suggestions you can act on immediately. If you want extra
          help, you can turn on the AI enrichment with your own key.
        </p>

        <p>
          Liveviewer does not check screen reader compatibility, interactive widgets, or PDFs. It
          catches the most common issues: low contrast, missing labels, broken heading hierarchies,
          and bad typography.
        </p>
      </section>

      <section className="mt-12 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">What it checks</h2>
        <ul className="space-y-2 text-base text-[var(--jao-text-secondary)]">
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-success)]">&#10003;</span>
            <span>WCAG contrast ratios with correct alpha blending for rgba colors</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-success)]">&#10003;</span>
            <span>Font sizes (minimum 16px for body text)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-success)]">&#10003;</span>
            <span>Line height readability (between 1.4 and 1.6)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-success)]">&#10003;</span>
            <span>Horizontal scroll issues</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-success)]">&#10003;</span>
            <span>Heading hierarchy (no skipping levels)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-success)]">&#10003;</span>
            <span>Missing alt text, empty buttons, missing form labels</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-success)]">&#10003;</span>
            <span>Skip navigation and main landmark detection</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-success)]">&#10003;</span>
            <span>Deterministic fix suggestions (no API key required)</span>
          </li>
        </ul>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">What it does not do</h2>
        <ul className="space-y-2 text-base text-[var(--jao-text-secondary)]">
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-destructive)]">&mdash;</span>
            <span>Test screen reader compatibility</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-destructive)]">&mdash;</span>
            <span>Audit interactive widgets or dynamic content</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-destructive)]">&mdash;</span>
            <span>Check PDFs, emails, or native mobile apps</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-destructive)]">&mdash;</span>
            <span>Walk through multi-step forms or login flows</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--jao-destructive)]">&mdash;</span>
            <span>Store your data (everything stays in your browser)</span>
          </li>
        </ul>
      </section>

      <section className="mt-12 border-t border-[var(--jao-border-subtle)] pt-8 text-center">
        <p className="text-base text-[var(--jao-text-tertiary)]">
          Built by{' '}
          <a
            href="https://jaostudio.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[var(--jao-primary)]"
          >
            Jao
          </a>
          . Independent dev tool, made with care.
        </p>
        <p className="mt-2 text-sm text-[var(--jao-text-tertiary)]">
          <Link href="/" className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]">
            Back to Liveviewer
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
          <a
            href="https://github.com/jamesonolitoquit/liveviewer/blob/master/CHANGELOG.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-[var(--jao-primary)]"
          >
            Changelog
          </a>
        </p>
      </section>
    </div>
  )
}
