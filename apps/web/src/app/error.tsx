'use client'

import { AlertTriangle } from 'lucide-react'

export default function RootError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 text-center" role="alert">
      <AlertTriangle size={40} className="mb-4 text-[var(--jao-destructive)]" />
      <h1 className="mb-2 text-xl font-bold text-[var(--jao-text)]">Something went wrong</h1>
      <p className="mb-6 text-sm text-[var(--jao-text-secondary)]">
        {error.message || 'An unexpected error occurred while loading the page.'}
      </p>
      <button
        onClick={reset}
        className="rounded-lg bg-[var(--jao-primary)] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}
