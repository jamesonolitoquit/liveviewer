'use client'

import { AlertTriangle } from 'lucide-react'

export default function HistoryError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="rounded-lg border border-[var(--jao-destructive)]/30 bg-[var(--jao-destructive)]/5 p-6 text-center" role="alert">
        <AlertTriangle size={32} className="mx-auto mb-3 text-[var(--jao-destructive)]" />
        <h2 className="mb-2 text-lg font-semibold text-[var(--jao-text)]">Failed to load history</h2>
        <p className="mb-4 text-sm text-[var(--jao-text-secondary)]">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-lg bg-[var(--jao-primary)] px-4 py-2 text-sm font-medium text-[var(--jao-surface)] transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
