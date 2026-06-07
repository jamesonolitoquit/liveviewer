'use client'

import { useState, FormEvent } from 'react'

interface AuditFormProps {
  onRun: (url: string) => void
  isRunning: boolean
}

export function AuditForm({ onRun, isRunning }: AuditFormProps) {
  const [url, setUrl] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (url.trim()) onRun(url.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3">
      <input
        type="url"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://example.com"
        required
        disabled={isRunning}
        className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--primary)]"
      />
      <button
        type="submit"
        disabled={isRunning || !url.trim()}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--primary-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Auditing…
          </>
        ) : (
          'Run Audit'
        )}
      </button>
    </form>
  )
}
