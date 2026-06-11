'use client'

import Link from 'next/link'
import { FileQuestion } from 'lucide-react'

export default function ReportError() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <FileQuestion size={40} className="mx-auto mb-4 text-[var(--jao-text-tertiary)]" />
      <h1 className="mb-3 text-xl font-semibold text-[var(--jao-text)]">Report not found</h1>
      <p className="mb-6 text-sm text-[var(--jao-text-secondary)]">
        This shared report may have expired or been removed.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--jao-primary)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Run a new audit
      </Link>
    </div>
  )
}
